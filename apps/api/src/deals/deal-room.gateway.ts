import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { JwtPayloadSchema } from '@khanij/types';
import { UserRole } from '@prisma/client';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 5000;
const MESSAGE_HISTORY_LIMIT = 50;

// ─── Types ─────────────────────────────────────────────────────────────────

type AuthenticatedSocket = Socket & {
  data: {
    userId: string;
    orgId: string;
    role: UserRole;
    email: string;
  };
};

// ─── Helper ────────────────────────────────────────────────────────────────

/** Strip HTML tags and trim whitespace from message content. */
function sanitizeContent(raw: string): string {
  return raw.replace(/<[^>]*>/g, '').trim();
}

// ─── Gateway ───────────────────────────────────────────────────────────────

// TODO: Add Redis adapter (@socket.io/redis-adapter) for cross-pod pub/sub
// in multi-instance deployments. Without it, messages only broadcast within
// the same Node process.

@WebSocketGateway({
  namespace: '/deal-room',
  cors: {
    origin: (process.env['CORS_ORIGINS'] ?? process.env['APP_BASE_URL'] ?? '*')
      .split(',').map((o: string) => o.trim()).filter(Boolean),
  },
})
export class DealRoomGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Connection lifecycle ──────────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined;
      if (!token) {
        this.logger.warn(
          `WS connection rejected: no token, socketId=${client.id}`,
          'DealRoomGateway',
        );
        client.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      // Strip "Bearer " prefix if present
      const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      const decoded = this.jwt.verify(rawToken);
      const payload = JwtPayloadSchema.safeParse(decoded);

      if (!payload.success) {
        this.logger.warn(
          `WS connection rejected: invalid JWT payload, socketId=${client.id}`,
          'DealRoomGateway',
        );
        client.emit('error', { code: 'AUTH_INVALID', message: 'Invalid token payload' });
        client.disconnect(true);
        return;
      }

      // Attach user data to socket for downstream handlers
      client.data = {
        userId: payload.data.sub,
        orgId: payload.data.orgId,
        role: payload.data.role as UserRole,
        email: payload.data.email,
      };

      this.logger.log(
        `WS connected userId=${payload.data.sub} orgId=${payload.data.orgId} socketId=${client.id}`,
        'DealRoomGateway',
      );
    } catch (err) {
      this.logger.warn(
        `WS connection rejected: JWT verification failed, socketId=${client.id}`,
        'DealRoomGateway',
      );
      client.emit('error', { code: 'AUTH_INVALID', message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(
      `WS disconnected socketId=${client.id} userId=${client.data?.userId ?? 'unknown'}`,
      'DealRoomGateway',
    );
  }

  // ─── Join deal room ────────────────────────────────────────────────────

  @SubscribeMessage('join-deal')
  async joinDeal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { dealId: string },
  ): Promise<void> {
    const { dealId } = data;
    const { userId, orgId } = client.data;

    if (!dealId || typeof dealId !== 'string') {
      client.emit('error', { code: 'INVALID_PAYLOAD', message: 'dealId is required' });
      return;
    }

    // Verify the deal exists and user's org is a participant
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { buyerOrgId: true, sellerOrgId: true },
    });

    if (!deal) {
      client.emit('error', { code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
      return;
    }

    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      client.emit('error', {
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal room',
      });
      return;
    }

    const roomName = `deal:${dealId}`;
    await client.join(roomName);

    // Load last N messages (newest first, then reverse for chronological order)
    const history = await this.prisma.dealMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_HISTORY_LIMIT,
    });
    history.reverse(); // oldest-first for display

    client.emit('deal-history', { dealId, messages: history });

    // Notify other room members
    client.to(roomName).emit('user-joined', {
      dealId,
      userId,
      orgId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `User joined deal room userId=${userId} dealId=${dealId}`,
      'DealRoomGateway',
    );
  }

  // ─── Send message ─────────────────────────────────────────────────────

  @SubscribeMessage('send-message')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { dealId: string; content: string },
  ): Promise<void> {
    const { dealId, content } = data;
    const { userId, orgId, role } = client.data;

    if (!dealId || typeof dealId !== 'string') {
      client.emit('error', { code: 'INVALID_PAYLOAD', message: 'dealId is required' });
      return;
    }

    if (!content || typeof content !== 'string') {
      client.emit('error', { code: 'INVALID_PAYLOAD', message: 'content is required' });
      return;
    }

    // Verify client has joined this deal room
    const roomName = `deal:${dealId}`;
    if (!client.rooms.has(roomName)) {
      client.emit('error', {
        code: 'NOT_IN_ROOM',
        message: 'You must join the deal room before sending messages',
      });
      return;
    }

    // Sanitize and validate content length
    const sanitized = sanitizeContent(content);
    if (sanitized.length === 0) {
      client.emit('error', { code: 'EMPTY_MESSAGE', message: 'Message content cannot be empty' });
      return;
    }
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
      client.emit('error', {
        code: 'MESSAGE_TOO_LONG',
        message: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      });
      return;
    }

    // Determine sender type based on user role
    const senderType = role === UserRole.BUYER ? 'BUYER' : 'SELLER';

    // Persist the message
    const message = await this.prisma.dealMessage.create({
      data: {
        dealId,
        senderType,
        senderOrgId: orgId,
        senderUserId: userId,
        content: sanitized,
      },
    });

    // Broadcast to all room members (including sender)
    this.server.to(roomName).emit('new-message', {
      id: message.id,
      dealId: message.dealId,
      senderType: message.senderType,
      senderOrgId: message.senderOrgId,
      senderUserId: message.senderUserId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    });

    // Audit log
    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'deal.message.sent',
      entityType: 'DealMessage',
      entityId: message.id,
      after: { dealId, senderType, contentLength: sanitized.length },
    });

    this.logger.log(
      `Message sent dealId=${dealId} messageId=${message.id} by=${userId}`,
      'DealRoomGateway',
    );
  }
}
