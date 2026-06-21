import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { LoggerService } from '../logger/logger.service';
import { InvoiceStatus as PrismaInvoiceStatus } from '@prisma/client';
import { generateInvoice, type InvoiceInput } from '@khanij/finance';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: LoggerService,
  ) {}

  // ─── Generate Invoice ───────────────────────────────────────────────────

  async generateInvoice(dealId: string, userId: string, ip?: string) {
    // Load deal with buyer/seller orgs and quote
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        buyerOrg: { select: { id: true, legalName: true, gstin: true, state: true } },
        sellerOrg: { select: { id: true, legalName: true, gstin: true, state: true } },
        quote: { select: { pricePerUnitPaise: true } },
      },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    // Resolve mineral for HSN code
    const mineral = await this.prisma.mineral.findUnique({
      where: { id: deal.mineralId },
    });

    if (!mineral) {
      throw new NotFoundException({ code: 'MINERAL_NOT_FOUND', message: 'Mineral not found' });
    }

    // Generate sequential invoice number: KN-{YYYYMMDD}-{sequential}
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `KN-${dateStr}-`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let seq = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    const invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`;

    // Call @khanij/finance generateInvoice for line items and GST
    const invoiceInput: InvoiceInput = {
      dealId,
      invoiceNumber,
      sellerName: deal.sellerOrg.legalName,
      sellerGstin: deal.sellerOrg.gstin ?? '',
      sellerState: deal.sellerOrg.state,
      buyerName: deal.buyerOrg.legalName,
      buyerGstin: deal.buyerOrg.gstin ?? '',
      buyerState: deal.buyerOrg.state,
      mineralName: mineral.name,
      hsnCode: mineral.hsnCode ?? '2601',
      quantity: Number(deal.quantity),
      unit: deal.unit,
      ratePerUnitPaise: deal.quote.pricePerUnitPaise,
    };

    const generated = generateInvoice(invoiceInput);

    // Create Invoice record in Prisma (DRAFT status)
    const invoice = await this.prisma.invoice.create({
      data: {
        dealId,
        invoiceNumber,
        status: PrismaInvoiceStatus.DRAFT,
        sellerOrgId: deal.sellerOrgId,
        buyerOrgId: deal.buyerOrgId,
        subtotalPaise: generated.subtotalPaise,
        igstPaise: generated.gst.igstPaise,
        cgstPaise: generated.gst.cgstPaise,
        sgstPaise: generated.gst.sgstPaise,
        totalTaxPaise: generated.gst.totalTaxPaise,
        grandTotalPaise: generated.grandTotalPaise,
        lineItems: JSON.parse(
          JSON.stringify(generated.lineItems, (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
        ),
        gstRate: generated.gst.gstRate,
        isInterstate: generated.gst.isInterstate,
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: deal.sellerOrgId,
      action: 'invoice.generated',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: {
        invoiceNumber,
        dealId,
        status: PrismaInvoiceStatus.DRAFT,
        grandTotalPaise: invoice.grandTotalPaise.toString(),
      },
      ip,
    });

    this.logger.log(
      `Invoice generated id=${invoice.id} number=${invoiceNumber} deal=${dealId}`,
      'InvoiceService',
    );

    return this.serialize(invoice);
  }

  // ─── Issue Invoice ──────────────────────────────────────────────────────

  async issueInvoice(invoiceId: string, orgId: string, userId: string, ip?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    // Only seller can issue
    if (invoice.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_SELLER',
        message: 'Only the seller can issue an invoice',
      });
    }

    if (invoice.status !== PrismaInvoiceStatus.DRAFT) {
      throw new BadRequestException({
        code: 'INVOICE_NOT_DRAFT',
        message: `Cannot issue invoice in ${invoice.status} status — only DRAFT invoices can be issued`,
      });
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: PrismaInvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
    });

    await this.audit.log({
      actor: userId,
      actorOrgId: orgId,
      action: 'invoice.issued',
      entityType: 'Invoice',
      entityId: invoiceId,
      before: { status: PrismaInvoiceStatus.DRAFT },
      after: { status: PrismaInvoiceStatus.ISSUED },
      ip,
    });

    this.logger.log(
      `Invoice issued id=${invoiceId} number=${invoice.invoiceNumber}`,
      'InvoiceService',
    );

    return this.serialize(updated);
  }

  // ─── Find by Deal ───────────────────────────────────────────────────────

  async findByDeal(dealId: string, orgId: string) {
    // Access check: must be buyer or seller of the deal
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { buyerOrgId: true, sellerOrgId: true },
    });

    if (!deal) {
      throw new NotFoundException({ code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }

    if (deal.buyerOrgId !== orgId && deal.sellerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'DEAL_ACCESS_DENIED',
        message: 'You do not have access to this deal',
      });
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map(this.serialize);
  }

  // ─── Find by ID ─────────────────────────────────────────────────────────

  async findById(invoiceId: string, orgId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }

    if (invoice.sellerOrgId !== orgId && invoice.buyerOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'INVOICE_ACCESS_DENIED',
        message: 'You do not have access to this invoice',
      });
    }

    return this.serialize(invoice);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Serialize for JSON response (BigInt → string, Decimal → number). */
  private serialize(record: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(record, (_key, value) => {
        if (typeof value === 'bigint') return value.toString();
        if (value && typeof value === 'object' && 'toNumber' in value) {
          return (value as { toNumber: () => number }).toNumber();
        }
        return value;
      }),
    );
  }
}
