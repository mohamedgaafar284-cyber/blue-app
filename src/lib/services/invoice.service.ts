// @ts-check
/**
 * Invoice Service
 * خدمة الفواتير
 * 
 * Business logic layer for invoice operations
 */

import { db, TransactionClient } from '@/lib/db';
import { log } from '@/lib/logger';
import { insensitiveContains } from '@/app/api/utils/db';
import { logAudit } from './audit.service';
import { createInvoiceJournalEntry, createPaymentJournalEntry } from './accounting.service';
import { sequenceService } from './sequence.service';
import { automationService } from './automation.service';
import { Invoice, Prisma } from '@prisma/client';

/**
 * Invoice filtering options
 */
export interface InvoiceFilters {
  status?: string;
  clientId?: string;
  projectId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

/**
 * Pagination parameters
 */
export interface InvoicePaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface InvoicePaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Create invoice input
 */
export interface CreateInvoiceInput {
  clientId?: string;
  projectId?: string;
  issueDate?: Date;
  dueDate?: Date;
  subtotal?: number;
  taxRate?: number;
  notes?: string;
  items?: { description: string; quantity: number; unitPrice: number; total: number; revenueCode?: string }[];
}

/**
 * Invoice statistics
 */
export interface InvoiceStats {
  total: number;
  DRAFT: number;
  SENT: number;
  PAID: number;
  OVERDUE: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

// VAT FILS ROUNDING (FTA-compliant): monetary values are rounded to 2 decimal
// places (fils) with ROUND_HALF_UP at LINE level — the invoice subtotal is the sum
// of rounded line totals, so stored items, subtotal, tax and total always agree
// with what is printed on the tax invoice PDF. No more 5.2775-style fractions.
// Module-level helper shared by createInvoice / updateInvoice / recordPayment.
const round2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/**
 * Invoice Service
 * Handles all business logic related to invoices
 * taxRate convention: PERCENT (5.0 = 5%) — matches the DB column, UI and PDF.
 */
class InvoiceService {
  /**
   * Get all invoices with pagination and filtering
   */
  async getInvoices(
    organizationId: string,
    filters?: InvoiceFilters,
    pagination?: InvoicePaginationParams
  ): Promise<InvoicePaginatedResult<Invoice>> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId, deletedAt: null };

    // Apply filters
    if (filters?.status) where.status = filters.status;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.projectId) where.projectId = filters.projectId;

    if (filters?.dateFrom || filters?.dateTo) {
      where.issueDate = {};
      if (filters?.dateFrom) (where.issueDate as Record<string, Date>).gte = filters.dateFrom;
      if (filters?.dateTo) (where.issueDate as Record<string, Date>).lte = filters.dateTo;
    }

    if (filters?.search) {
      where.OR = [
        { number: insensitiveContains(filters.search) },
      ];
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: pagination?.sortBy
          ? { [pagination.sortBy]: pagination.sortOrder || 'desc' }
          : { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string, organizationId: string): Promise<Invoice | null> {
    return db.invoice.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        client: true,
      },
    });
  }

  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber(organizationId: string): Promise<string> {
    return sequenceService.generateDocumentNumber('INV', 'INVOICE', organizationId);
  }

  /**
   * Create a new invoice
   */
  async createInvoice(
    data: CreateInvoiceInput,
    organizationId: string,
    userId: string
  ): Promise<Invoice> {
    // Calculate subtotal from items if available to prevent client-side desync,
    // fallback to data.subtotal or 0.
    // Line-level fils rounding — see round2 at module scope.

    const subtotalDec = data.items && data.items.length > 0
      ? data.items.reduce((sum, item) => sum.add(round2(new Prisma.Decimal(item.quantity || 1).mul(new Prisma.Decimal(item.unitPrice || 0)))), new Prisma.Decimal(0))
      : round2(new Prisma.Decimal(data.subtotal || 0));

    // NOTE: taxRate convention is PERCENT (5.0 = 5%), matching the DB column and UI.
    const defaultTaxRate = new Prisma.Decimal(5.0);
    const taxRateDec = data.taxRate !== undefined ? new Prisma.Decimal(data.taxRate) : defaultTaxRate;
    const taxDec = round2(subtotalDec.mul(taxRateDec.div(100)));
    const totalDec = subtotalDec.add(taxDec);

    // Use transaction for safe creation
    return await db.$transaction(async (tx) => {
      const invoiceNumber = await sequenceService.generateDocumentNumber('INV', 'INVOICE', organizationId);

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          organizationId,
          clientId: data.clientId || '',
          projectId: data.projectId || '',
          issueDate: data.issueDate || new Date(),
          dueDate: data.dueDate || new Date(),
          subtotal: subtotalDec,
          taxRate: taxRateDec,
          tax: taxDec,
          total: totalDec,
          paidAmount: new Prisma.Decimal(0),
          remaining: totalDec,
          status: 'DRAFT',
          ...(data.items && data.items.length > 0 ? {
            items: {
              create: data.items.map(item => {
                const itemQty = new Prisma.Decimal(item.quantity || 1);
                const itemPrice = new Prisma.Decimal(item.unitPrice || 0);
                // Line-level fils rounding — keeps item.total consistent with the
                // rounded-line subtotal used for the invoice header above.
                const itemTotal = round2(itemQty.mul(itemPrice));
                return {
                  description: item.description,
                  quantity: itemQty,
                  unitPrice: itemPrice,
                  total: itemTotal,
                  revenueCode: item.revenueCode || "4010"
                };
              })
            }
          } : {})
        },
        include: {
          client: { select: { id: true, name: true, company: true } },
          project: { select: { id: true, name: true, nameEn: true, number: true } },
          items: { orderBy: { createdAt: "asc" } },
        },
      });

      await logAudit({
        userId,
        organizationId,
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'create',
        description: `تم إنشاء الفاتورة: ${invoice.number}`,
        metadata: { projectId: data.projectId, newValue: invoice },
      });

      return invoice;
    });
  }

  /**
   * Update invoice
   */
  async updateInvoice(
    id: string,
    data: Partial<Invoice>,
    organizationId: string,
    userId: string
  ): Promise<Invoice> {
    // SECURITY: Explicit field whitelist to prevent Mass Assignment
    // SECURITY: 'total', 'paidAmount', and 'remaining' are computed fields — they must NOT be set directly.
    // They are recalculated from subtotal/taxRate or via recordPayment().
    const allowedFields = ['clientId', 'projectId', 'issueDate', 'dueDate', 'subtotal', 'taxRate', 'tax', 'status'] as const;
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if ((data as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (data as Record<string, unknown>)[field];
      }
    }

    return await db.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findFirst({
        where: { id, organizationId },
      });

      if (!currentInvoice) {
        throw new Error('Invoice not found or access denied');
      }

      if (currentInvoice.status !== 'DRAFT') {
        if (data.subtotal !== undefined || data.taxRate !== undefined || data.tax !== undefined || data.total !== undefined) {
          throw new Error('Cannot edit financial details of a sent or paid invoice. Please void and issue a new invoice.');
        }
      }

      // Recalculate totals if subtotal, tax rate, or paidAmount changed
      if (data.subtotal !== undefined || data.taxRate !== undefined || data.paidAmount !== undefined) {
        // Same fils-rounding convention as createInvoice (ROUND_HALF_UP, 2dp).
        const subtotal = round2(new Prisma.Decimal(data.subtotal !== undefined ? data.subtotal : currentInvoice.subtotal));
        const taxRate = new Prisma.Decimal(data.taxRate !== undefined ? data.taxRate : currentInvoice.taxRate);
        const tax = round2(subtotal.mul(taxRate.div(100)));
        const total = subtotal.add(tax);
        const paidAmount = new Prisma.Decimal(data.paidAmount !== undefined ? data.paidAmount : currentInvoice.paidAmount);
        updateData.tax = tax;
        updateData.total = total;
        updateData.remaining = total.sub(paidAmount);
      }

      await tx.invoice.updateMany({
        where: { id, organizationId },
        data: updateData,
      });

      const updated = await tx.invoice.findFirst({
        where: { id, organizationId },
      });

      if (!updated) {
        throw new Error('Invoice not found or access denied after update');
      }

      await logAudit({
        userId,
        organizationId,
        entityType: 'invoice',
        entityId: updated.id,
        action: 'update',
        description: `تم تحديث الفاتورة: ${updated.number}`,
        metadata: { projectId: updated.projectId, oldValue: currentInvoice, newValue: updated },
      });

      return updated;
    });
  }



  /**
   * Delete invoice
   */
  async deleteInvoice(id: string, organizationId: string, userId: string): Promise<void> {
    const invoice = await db.invoice.findFirst({
      where: { id, organizationId },
    });

    if (!invoice) {
      throw new Error('Invoice not found or access denied');
    }

    await db.invoice.updateMany({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId,
      organizationId,
      entityType: 'invoice',
      entityId: id,
      action: 'delete',
      description: `تم حذف الفاتورة: ${invoice.number}`,
      metadata: { projectId: invoice.projectId, oldValue: invoice },
    });
  }

  /**
   * Mark invoice as sent
   */
  async markAsSent(id: string, organizationId: string, userId: string): Promise<Invoice> {
    return await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, organizationId, deletedAt: null },
      });
      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }

      if (invoice.status === 'DRAFT') {
        // Atomic status transition using OCC to avoid race conditions
        const updateResult = await tx.invoice.updateMany({
          where: { id, organizationId, status: 'DRAFT', deletedAt: null },
          data: { status: 'SENT' },
        });

        if (updateResult.count === 0) {
          // Another request already transitioned this invoice
          const current = await tx.invoice.findFirst({ where: { id, organizationId } });
          return current || invoice;
        }

        // GL Integration: Auto-create journal entry for the invoice
        try {
          await createInvoiceJournalEntry(
            tx,
            organizationId,
            invoice.number,
            Number(invoice.subtotal),
            Number(invoice.tax),
            userId
          );
        } catch (glError) {
          log.error('GL: Failed to create journal entry for invoice on markAsSent', {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            error: glError instanceof Error ? glError.message : String(glError),
          });
          throw glError; // Rethrow to rollback transaction!
        }
      }

      const finalInvoice = await tx.invoice.findFirst({
        where: { id, organizationId },
        include: {
          client: { select: { id: true, name: true, company: true } },
          project: { select: { id: true, name: true, nameEn: true, number: true } },
          items: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!finalInvoice) throw new Error('Invoice not found after update');

      await automationService.triggerEvent('INVOICE_SENT', {
        organizationId,
        entityId: id,
        userId
      });

      return finalInvoice;
    });
  }

  /**
   * Record payment
   */
  async recordPayment(
    id: string,
    amountInput: number,
    organizationId: string,
    userId: string,
    paymentMethod: 'cash' | 'bank' = 'bank',
    externalTx?: TransactionClient
  ): Promise<Invoice> {
    if (amountInput <= 0) {
      throw new Error('Payment amount must be positive');
    }
    // Defensive fils rounding: keep paidAmount/remaining at money precision (2dp)
    const amount = round2(new Prisma.Decimal(amountInput)).toNumber();

    const executeWithTx = async (tx: TransactionClient): Promise<Invoice> => {
      // First verify the invoice belongs to the organization and is not deleted
      const invoice = await tx.invoice.findFirst({
        where: { id, organizationId, deletedAt: null },
      });

      if (!invoice) {
        throw new Error('Invoice not found or access denied');
      }

      if (invoice.status === 'DRAFT') {
        throw new Error('Cannot record payment for a DRAFT invoice. Send the invoice first.');
      }

      if (invoice.status === 'CANCELLED') {
        throw new Error('Cannot record payment for a CANCELLED invoice.');
      }

      const currentPaid = new Prisma.Decimal(invoice.paidAmount);
      const total = new Prisma.Decimal(invoice.total);
      const amountDec = new Prisma.Decimal(amount);

      // Overpayment protection: payments cannot exceed the total invoice amount
      if (currentPaid.add(amountDec).gt(total)) {
        throw new Error(`Payment amount exceeds remaining balance. Remaining: ${total.sub(currentPaid).toNumber()}`);
      }

      // Use optimistic concurrency control (OCC) matching on current paidAmount to prevent concurrent updates
      const updateResult = await tx.invoice.updateMany({
        where: { id, organizationId, paidAmount: invoice.paidAmount, deletedAt: null },
        data: {
          paidAmount: { increment: amount }
        }
      });

      if (updateResult.count === 0) {
        throw new Error('CONCURRENT_UPDATE_ERROR');
      }

      const newPaidAmount = currentPaid.add(amountDec);
      const status = newPaidAmount.gte(total) ? 'PAID' : 'PARTIALLY_PAID';
      const remaining = total.sub(newPaidAmount).gt(0) ? total.sub(newPaidAmount) : new Prisma.Decimal(0);

      // Update status and remaining
      const finalUpdateResult = await tx.invoice.updateMany({
        where: { id, organizationId, paidAmount: newPaidAmount, deletedAt: null },
        data: { status, remaining }
      });

      if (finalUpdateResult.count === 0) {
        throw new Error('CONCURRENT_UPDATE_ERROR');
      }

      const finalInvoice = await tx.invoice.findFirst({ where: { id, organizationId, deletedAt: null }});
      if (!finalInvoice) throw new Error('Invoice not found after final update');

      await logAudit({
        userId,
        organizationId,
        entityType: 'invoice',
        entityId: id,
        action: 'payment',
        description: `تسجيل دفعة للفاتورة: ${finalInvoice.number} بقيمة ${amount}`,
        metadata: { projectId: finalInvoice.projectId, amount, newStatus: status },
      });

      // GL Integration: Auto-create journal entry for the payment
      // Debit: Cash/Bank, Credit: Accounts Receivable
      try {
        const finalPayMethod = paymentMethod === 'cash' ? 'cash' : 'bank';
        await createPaymentJournalEntry(tx, organizationId, finalInvoice.number, amount, finalPayMethod, userId);
      } catch (glError) {
        log.error('GL: Failed to create journal entry for payment', {
          invoiceId: id,
          invoiceNumber: finalInvoice.number,
          amount,
          error: glError instanceof Error ? glError.message : String(glError),
        });
        throw glError; // Rethrow to rollback transaction!
      }

      return finalInvoice;
    };

    if (externalTx) {
      return await executeWithTx(externalTx);
    }
    return await db.$transaction(executeWithTx);
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(organizationId: string): Promise<InvoiceStats> {
    const [statusCounts, aggregates] = await Promise.all([
      db.invoice.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: true,
        _sum: { total: true, paidAmount: true },
      }),
      db.invoice.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { total: true, paidAmount: true },
      }),
    ]) as [Array<{ status: string; _count: number; _sum: { total: number | null; paidAmount: number | null } }>, { _sum: { total: number | null; paidAmount: number | null } | null }];

    const stats: InvoiceStats = {
      total: 0,
      DRAFT: 0,
      SENT: 0,
      PAID: 0,
      OVERDUE: 0,
      totalAmount: aggregates._sum?.total || 0,
      paidAmount: aggregates._sum?.paidAmount || 0,
      outstandingAmount: (aggregates._sum?.total || 0) - (aggregates._sum?.paidAmount || 0),
    };

    // Get overdue count
    stats.OVERDUE = await db.invoice.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { notIn: ['PAID', 'DRAFT', 'CANCELLED'] },
        dueDate: { lt: new Date() },
      },
    });

    for (const item of statusCounts) {
      stats.total += item._count;
      switch (item.status) {
        case 'DRAFT':
          stats.DRAFT = item._count;
          break;
        case 'SENT':
          stats.SENT = item._count;
          break;
        case 'PAID':
          stats.PAID = item._count;
          break;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();
