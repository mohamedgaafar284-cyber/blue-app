import { describe, it, expect, beforeEach } from '@jest/globals';
import { db } from '@/lib/db';
import { AccountingService, createExpenseJournalEntry, createInvoiceJournalEntry, createPaymentJournalEntry } from '@/lib/services/accounting.service';

describe('Accounting Service & GL Auto-Posting (M1.5 / QW1-3)', () => {
  let testOrgId = '';
  const testUserId = 'user-test-acc';

  beforeEach(async () => {
    if (!testOrgId) {
      const org = await db.organization.findFirst();
      testOrgId = org ? org.id : 'org-test-fallback';
    }

    // Ensure default chart of accounts is seeded for test organization
    await db.$transaction(async (tx) => {
      const existing = await tx.account.findFirst({ where: { organizationId: testOrgId } });
      if (!existing) {
        await AccountingService.seedDefaultAccounts(tx, testOrgId);
      }
    });
  });

  it('should seed standard chart of accounts with required codes (1010, 1020, 1100, 2100, 2200, 4010, 5010-5100)', async () => {
    const accounts = await db.account.findMany({
      where: { organizationId: testOrgId },
      select: { code: true, type: true },
    });

    const codes = accounts.map(a => a.code);
    expect(codes).toContain('1010'); // Cash
    expect(codes).toContain('1020'); // Bank
    expect(codes).toContain('1100'); // Accounts Receivable
    expect(codes).toContain('2100'); // Accounts Payable
    expect(codes).toContain('2200'); // VAT Payable
    expect(codes).toContain('4010'); // Service Revenue
    expect(codes).toContain('5100'); // General Expense
  });

  it('should auto-post balanced double-entry journal for invoice (Debit AR, Credit Revenue, Credit VAT)', async () => {
    const invNumber = `INV-TEST-${Date.now()}`;
    const subtotal = 10000;
    const tax = 500; // 5% VAT
    const total = 10500;

    await db.$transaction(async (tx) => {
      await createInvoiceJournalEntry(tx, testOrgId, invNumber, subtotal, tax, testUserId);
    });

    const entry = await db.journalEntry.findFirst({
      where: { organizationId: testOrgId, reference: invNumber },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    expect(entry).not.toBeNull();
    expect(entry?.lines.length).toBeGreaterThanOrEqual(3);

    const totalDebit = entry!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry!.lines.reduce((s, l) => s + Number(l.credit), 0);

    expect(totalDebit).toBe(total);
    expect(totalCredit).toBe(total);
    expect(totalDebit).toBe(totalCredit); // Perfect double-entry balance!
  });

  it('should auto-post balanced payment journal entry (Debit Bank/Cash, Credit AR)', async () => {
    const invNumber = `INV-PAY-${Date.now()}`;
    const payAmount = 5000;

    await db.$transaction(async (tx) => {
      await createPaymentJournalEntry(tx, testOrgId, invNumber, payAmount, 'bank', testUserId);
    });

    const entry = await db.journalEntry.findFirst({
      where: { organizationId: testOrgId, reference: `PAYMENT-${invNumber}` },
      include: {
        lines: { include: { account: true } },
      },
    });

    expect(entry).not.toBeNull();
    const bankLine = entry?.lines.find(l => l.account.code === '1020');
    const arLine = entry?.lines.find(l => l.account.code === '1100');

    expect(bankLine).toBeDefined();
    expect(Number(bankLine?.debit)).toBe(payAmount);
    expect(arLine).toBeDefined();
    expect(Number(arLine?.credit)).toBe(payAmount);
  });

  it('should auto-post operating expense journal entry to correct expense account (QW3)', async () => {
    const expRef = `EXP-TEST-${Date.now()}`;
    const amount = 2500;

    await db.$transaction(async (tx) => {
      await createExpenseJournalEntry(
        tx,
        testOrgId,
        expRef,
        'Site Fuel & Transport',
        amount,
        'travel', // Maps to 5030 Travel Expense
        'cash',   // Credits 1010 Cash
        testUserId
      );
    });

    const entry = await db.journalEntry.findFirst({
      where: { organizationId: testOrgId, reference: expRef },
      include: {
        lines: { include: { account: true } },
      },
    });

    expect(entry).not.toBeNull();
    const expLine = entry?.lines.find(l => l.account.code === '5030');
    const cashLine = entry?.lines.find(l => l.account.code === '1010');

    expect(expLine).toBeDefined();
    expect(Number(expLine?.debit)).toBe(amount);
    expect(cashLine).toBeDefined();
    expect(Number(cashLine?.credit)).toBe(amount);
  });

  it('should reflect posted entries in Income Statement and Trial Balance without manual touch', async () => {
    const incomeStatement = await AccountingService.getIncomeStatement(testOrgId);
    expect(incomeStatement.totalRevenue).toBeGreaterThanOrEqual(10000);
    expect(incomeStatement.totalExpense).toBeGreaterThanOrEqual(2500);
    expect(incomeStatement.netProfit).toBe(incomeStatement.totalRevenue - incomeStatement.totalExpense);

    const trialBalance = await AccountingService.getTrialBalance(testOrgId);
    expect(trialBalance.balancesMatch).toBe(true);
    expect(trialBalance.totalDebitSum).toBe(trialBalance.totalCreditSum);
  });
});

