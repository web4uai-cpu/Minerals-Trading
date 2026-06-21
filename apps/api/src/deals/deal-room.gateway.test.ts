import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DealRoomGateway } from './deal-room.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { UserRole } from '@prisma/client';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockJwt = {
  verify: jest.fn(),
};

const mockPrisma = {
  deal: { findUnique: jest.fn() },
  dealMessage: { findMany: jest.fn(), create: jest.fn() },
};

const mockAudit = { log: jest.fn() };
const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

// ─── Socket factory ────────────────────────────────────────────────────────

interface MockSocket {
  id: string;
  handshake: { auth: Record<string, unknown> };
  data: Record<string, unknown>;
  rooms: Set<string>;
  emit: jest.Mock;
  join: jest.Mock;
  to: jest.Mock;
  disconnect: jest.Mock;
}

function createMockSocket(overrides: Record<string, unknown> = {}): MockSocket {
  return {
    id: 'socket-1',
    handshake: { auth: {} },
    data: {},
    rooms: new Set<string>(),
    emit: jest.fn(),
    join: jest.fn(),
    to: jest.fn().mockReturnThis(),
    disconnect: jest.fn(),
    ...overrides,
  } as MockSocket;
}

// ─── Test suite ────────────────────────────────────────────────────────────

describe('DealRoomGateway', () => {
  let gateway: DealRoomGateway;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealRoomGateway,
        { provide: JwtService, useValue: mockJwt },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    gateway = module.get<DealRoomGateway>(DealRoomGateway);

    // Attach a mock server
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as DealRoomGateway['server'];
  });

  // ─── handleConnection ──────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('rejects connection without JWT token', async () => {
      const client = createMockSocket();

      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects connection with invalid JWT', async () => {
      const client = createMockSocket({
        handshake: { auth: { token: 'invalid-token' } },
      });

      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(client as never);

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'AUTH_INVALID',
        message: 'Invalid or expired token',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('accepts connection with valid JWT and attaches user data', async () => {
      const payload = {
        sub: 'cluser00000000000000001',
        orgId: 'clorg000000000000000001',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };

      const client = createMockSocket({
        handshake: { auth: { token: 'valid-token' } },
      });

      mockJwt.verify.mockReturnValue(payload);

      await gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data).toEqual({
        userId: 'cluser00000000000000001',
        orgId: 'clorg000000000000000001',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      });
    });
  });

  // ─── joinDeal ──────────────────────────────────────────────────────────

  describe('joinDeal', () => {
    it('rejects if user org is not a deal participant', async () => {
      const client = createMockSocket();
      client.data = {
        userId: 'user-1',
        orgId: 'stranger-org',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };

      mockPrisma.deal.findUnique.mockResolvedValue({
        buyerOrgId: 'buyer-org-1',
        sellerOrgId: 'seller-org-1',
      });

      await gateway.joinDeal(client as never, { dealId: 'deal-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal room',
      });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects if deal does not exist', async () => {
      const client = createMockSocket();
      client.data = {
        userId: 'user-1',
        orgId: 'buyer-org-1',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };

      mockPrisma.deal.findUnique.mockResolvedValue(null);

      await gateway.joinDeal(client as never, { dealId: 'nonexistent' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'DEAL_NOT_FOUND',
        message: 'Deal not found',
      });
    });

    it('joins room and emits history for valid participant', async () => {
      const client = createMockSocket();
      const toEmit = jest.fn();
      client.to = jest.fn().mockReturnValue({ emit: toEmit });
      client.data = {
        userId: 'user-1',
        orgId: 'buyer-org-1',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };

      mockPrisma.deal.findUnique.mockResolvedValue({
        buyerOrgId: 'buyer-org-1',
        sellerOrgId: 'seller-org-1',
      });

      const mockMessages = [
        { id: 'msg-1', content: 'Hello', createdAt: new Date() },
      ];
      mockPrisma.dealMessage.findMany.mockResolvedValue(mockMessages);

      await gateway.joinDeal(client as never, { dealId: 'deal-1' });

      expect(client.join).toHaveBeenCalledWith('deal:deal-1');
      expect(client.emit).toHaveBeenCalledWith('deal-history', {
        dealId: 'deal-1',
        messages: mockMessages,
      });
      expect(client.to).toHaveBeenCalledWith('deal:deal-1');
      expect(toEmit).toHaveBeenCalledWith(
        'user-joined',
        expect.objectContaining({
          dealId: 'deal-1',
          userId: 'user-1',
          orgId: 'buyer-org-1',
        }),
      );
    });
  });

  // ─── sendMessage ───────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('rejects if client has not joined the deal room', async () => {
      const client = createMockSocket();
      client.data = {
        userId: 'user-1',
        orgId: 'buyer-org-1',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };
      // rooms does not contain the deal room
      client.rooms = new Set(['socket-1']);

      await gateway.sendMessage(client as never, {
        dealId: 'deal-1',
        content: 'Hello',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'NOT_IN_ROOM',
        message: 'You must join the deal room before sending messages',
      });
      expect(mockPrisma.dealMessage.create).not.toHaveBeenCalled();
    });

    it('persists message and broadcasts to room', async () => {
      const now = new Date();
      const client = createMockSocket();
      client.data = {
        userId: 'user-1',
        orgId: 'buyer-org-1',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };
      client.rooms = new Set(['socket-1', 'deal:deal-1']);

      const createdMessage = {
        id: 'msg-new',
        dealId: 'deal-1',
        senderType: 'BUYER',
        senderOrgId: 'buyer-org-1',
        senderUserId: 'user-1',
        content: 'Test message',
        createdAt: now,
      };

      mockPrisma.dealMessage.create.mockResolvedValue(createdMessage);

      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.sendMessage(client as never, {
        dealId: 'deal-1',
        content: 'Test message',
      });

      // Verify persistence
      expect(mockPrisma.dealMessage.create).toHaveBeenCalledWith({
        data: {
          dealId: 'deal-1',
          senderType: 'BUYER',
          senderOrgId: 'buyer-org-1',
          senderUserId: 'user-1',
          content: 'Test message',
        },
      });

      // Verify broadcast
      expect(gateway.server.to).toHaveBeenCalledWith('deal:deal-1');
      expect(roomEmit).toHaveBeenCalledWith('new-message', {
        id: 'msg-new',
        dealId: 'deal-1',
        senderType: 'BUYER',
        senderOrgId: 'buyer-org-1',
        senderUserId: 'user-1',
        content: 'Test message',
        createdAt: now.toISOString(),
      });

      // Verify audit
      expect(mockAudit.log).toHaveBeenCalledWith({
        actor: 'user-1',
        actorOrgId: 'buyer-org-1',
        action: 'deal.message.sent',
        entityType: 'DealMessage',
        entityId: 'msg-new',
        after: { dealId: 'deal-1', senderType: 'BUYER', contentLength: 12 },
      });
    });

    it('strips HTML from message content', async () => {
      const client = createMockSocket();
      client.data = {
        userId: 'user-1',
        orgId: 'seller-org-1',
        role: UserRole.SELLER,
        email: 'seller@example.com',
      };
      client.rooms = new Set(['socket-1', 'deal:deal-1']);

      mockPrisma.dealMessage.create.mockResolvedValue({
        id: 'msg-2',
        dealId: 'deal-1',
        senderType: 'SELLER',
        senderOrgId: 'seller-org-1',
        senderUserId: 'user-1',
        content: 'Clean text',
        createdAt: new Date(),
      });

      const roomEmit = jest.fn();
      (gateway.server.to as jest.Mock).mockReturnValue({ emit: roomEmit });

      await gateway.sendMessage(client as never, {
        dealId: 'deal-1',
        content: '<script>alert("xss")</script>Clean text',
      });

      expect(mockPrisma.dealMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'alert("xss")Clean text',
            senderType: 'SELLER',
          }),
        }),
      );
    });

    it('rejects messages exceeding max length', async () => {
      const client = createMockSocket();
      client.data = {
        userId: 'user-1',
        orgId: 'buyer-org-1',
        role: UserRole.BUYER,
        email: 'buyer@example.com',
      };
      client.rooms = new Set(['socket-1', 'deal:deal-1']);

      const longContent = 'x'.repeat(5001);

      await gateway.sendMessage(client as never, {
        dealId: 'deal-1',
        content: longContent,
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
        code: 'MESSAGE_TOO_LONG',
        message: 'Message exceeds maximum length of 5000 characters',
      });
      expect(mockPrisma.dealMessage.create).not.toHaveBeenCalled();
    });
  });
});
