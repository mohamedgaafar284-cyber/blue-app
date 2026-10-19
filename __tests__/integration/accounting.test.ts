import { db } from "@/lib/db";
import { AccountingService } from "@/lib/services/accounting.service";
import { AccountType } from "@prisma/client";

describe("Accounting Engine & Double-Entry Ledger", () => {
  const testOrgId = "org-accounting-test";
  const testUserId = "user-accounting-test";

  beforeAll(async () => {
    // Enable SQLite foreign keys if local
    if (process.env.DATABASE_URL?.startsWith("file:")) {
      await db.$executeRaw`PRAGMA foreign_keys = OFF`;
    }

    // Clean up existing test data
    await db.journalLine.deleteMany();
    await db.journalEntry.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
    await db.organization.deleteMany();

    if (process.env.DATABASE_URL?.startsWith("file:")) {
      await db.$executeRaw`PRAGMA foreign_keys = ON`;
    }

    // Seed test organization & user
    await db.organization.create({
      data: {
        id: testOrgId,
        name: "Test Accounting Org",
        slug: "test-accounting-org",
      },
    });

    await db.user.create({
      data: {
        id: testUserId,
        email: "accountant-test@blueprint.ae",
        password: "hashed_password",
        name: "Test Accountant",
        role: "ACCOUNTANT",
        organizationId: testOrgId,
      },
    });
  });

  afterAll(async () => {
    // Cleanup with FK disabled
    if (process.env.DATABASE_URL?.startsWith("file:")) {
      await db.$executeRaw`PRAGMA foreign_keys = OFF`;
    }
    await db.invoiceItem.deleteMany();
    await db.invoice.deleteMany();
    await db.project.deleteMany();
    await db.client.deleteMany();
    await db.journalLine.deleteMany();
    await db.journalEntry.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
    await db.organization.deleteMany();
    if (process.env.DATABASE_URL?.startsWith("file:")) {
      await db.$executeRaw`PRAGMA foreign_keys = ON`;
    }
    await db.$disconnect();
  });

  it("1. should seed default Chart of Accounts for new organization", async () => {
    await db.$transaction(async (tx) => {
      await AccountingService.seedDefaultAccounts(tx, testOrgId);
    });

    const accounts = await AccountingService.getAccounts(testOrgId);
    expect(accounts.length).toBe(16); // 16 default accounts
    expect(accounts.some((acc) => acc.code === "1010")).toBe(true); // Cash
    expect(accounts.some((acc) => acc.code === "2100")).toBe(true); // Accounts Payable
    expect(accounts.some((acc) => acc.code === "4010")).toBe(true); // Service Revenue
  });

  it("2. should allow creating a custom account", async () => {
    const customAcc = await AccountingService.createAccount(
      testOrgId,
      {
        code: "5200",
        nameAr: "مصاريف تسويق",
        nameEn: "Marketing Expense",
        type: AccountType.EXPENSE,
        description: "Custom marketing expenses",
      },
      testUserId
    );

    expect(customAcc.code).toBe("5200");
    expect(customAcc.nameEn).toBe("Marketing Expense");

    const accounts = await AccountingService.getAccounts(testOrgId);
    expect(accounts.length).toBe(17);
  });

  it("3. should reject duplicate account codes in the same organization", async () => {
    await expect(
      AccountingService.createAccount(
        testOrgId,
        {
          code: "1010", // Existing cash code
          nameAr: "صندوق مكرر",
          nameEn: "Duplicate Cash",
          type: AccountType.ASSET,
        },
        testUserId
      )
    ).rejects.toThrow();
  });

  it("4. should post a valid double-entry journal entry", async () => {
    const accounts = await AccountingService.getAccounts(testOrgId);
    const bankAccount = accounts.find((a) => a.code === "1020")!;
    const serviceRevenue = accounts.find((a) => a.code === "4010")!;

    const entry = await AccountingService.createJournalEntry(
      testOrgId,
      {
        description: "Consulting fees received in Bank",
        reference: "INV-2026-001",
        lines: [
          { accountId: bankAccount.id, debit: 5000, credit: 0 },
          { accountId: serviceRevenue.id, debit: 0, credit: 5000 },
        ],
      },
      testUserId
    );

    expect(entry).toBeDefined();
    expect(entry?.lines.length).toBe(2);
    expect(Number(entry?.lines[0].debit)).toBe(5000);
    expect(Number(entry?.lines[1].credit)).toBe(5000);
  });

  it("5. should reject out-of-balance journal entries", async () => {
    const accounts = await AccountingService.getAccounts(testOrgId);
    const bankAccount = accounts.find((a) => a.code === "1020")!;
    const serviceRevenue = accounts.find((a) => a.code === "4010")!;

    await expect(
      AccountingService.createJournalEntry(
        testOrgId,
        {
          description: "Out of balance entry",
          lines: [
            { accountId: bankAccount.id, debit: 5000, credit: 0 },
            { accountId: serviceRevenue.id, debit: 0, credit: 4000 }, // Unequal!
          ],
        },
        testUserId
      )
    ).rejects.toThrow(/does not balance/);
  });

  it("6. should correctly compute Trial Balance, P&L, and Balance Sheet", async () => {
    const accounts = await AccountingService.getAccounts(testOrgId);
    const bankAccount = accounts.find((a) => a.code === "1020")!;
    const _serviceRevenue = accounts.find((a) => a.code === "4010")!;
    const salaryExpense = accounts.find((a) => a.code === "5010")!;
    const marketingExpense = accounts.find((a) => a.code === "5200")!;

    // Post an expense: Salary paid from Bank (Salary 3000 Dr, Bank 3000 Cr)
    await AccountingService.createJournalEntry(
      testOrgId,
      {
        description: "Employee salaries paid",
        lines: [
          { accountId: salaryExpense.id, debit: 3000, credit: 0 },
          { accountId: bankAccount.id, debit: 0, credit: 3000 },
        ],
      },
      testUserId
    );

    // Post another expense: Marketing paid from Bank (Marketing 500 Dr, Bank 500 Cr)
    await AccountingService.createJournalEntry(
      testOrgId,
      {
        description: "Ad campaign",
        lines: [
          { accountId: marketingExpense.id, debit: 500, credit: 0 },
          { accountId: bankAccount.id, debit: 0, credit: 500 },
        ],
      },
      testUserId
    );

    // 1. Trial Balance Validation
    const tb = await AccountingService.getTrialBalance(testOrgId);
    expect(tb.balancesMatch).toBe(true);
    expect(tb.totalDebitSum).toBe(5000); // 5000 (total debit normal check)
    expect(tb.totalCreditSum).toBe(5000);

    // Bank Account dynamic balance: 5000 Dr - 3000 Cr - 500 Cr = 1500 Dr
    const bankRow = tb.rows.find((r) => r.code === "1020")!;
    expect(bankRow.netBalance).toBe(1500);

    // 2. P&L / Income Statement Validation
    // Revenue: 5000, Expenses: 3000 + 500 = 3500. Net Profit: 1500.
    const pl = await AccountingService.getIncomeStatement(testOrgId);
    expect(pl.totalRevenue).toBe(5000);
    expect(pl.totalExpense).toBe(3500);
    expect(pl.netProfit).toBe(1500);

    // 3. Balance Sheet Validation
    // Assets: Bank (1500) = 1500
    // Liabilities: 0
    // Equity: Retained Earnings / Net Profit (1500) = 1500
    // Total Assets (1500) = Total Liabilities + Equity (1500)
    const bs = await AccountingService.getBalanceSheet(testOrgId);
    expect(bs.totalAssets).toBe(1500);
    expect(bs.totalLiabilities).toBe(0);
    expect(bs.totalEquity).toBe(1500);
    expect(bs.balancesMatch).toBe(true);
  });

  it("7. should auto-create balanced journal entries for invoices and VAT", async () => {
    const { createInvoiceJournalEntry } = await import("@/lib/services/accounting.service");
    
    // Subtotal: 10,000 AED, VAT (5%): 500 AED, Total: 10,500 AED
    const invNumber = "INV-TEST-VAT-001";
    await db.$transaction(async (tx) => {
      await createInvoiceJournalEntry(tx, testOrgId, invNumber, 10000, 500, testUserId);
    });

    const entry = await db.journalEntry.findFirst({
      where: { reference: invNumber, organizationId: testOrgId },
      include: { lines: { include: { account: true } } },
    });

    expect(entry).toBeDefined();
    expect(entry?.lines.length).toBe(3); // AR (10500 Dr), Rev (10000 Cr), VAT (500 Cr)

    const arLine = entry?.lines.find((l) => l.account.code === "1100");
    const revLine = entry?.lines.find((l) => l.account.code === "4010");
    const vatLine = entry?.lines.find((l) => l.account.code === "2200");

    expect(Number(arLine?.debit)).toBe(10500);
    expect(Number(revLine?.credit)).toBe(10000);
    expect(Number(vatLine?.credit)).toBe(500);
  });

  it("7b. should handle invoice items with custom revenue codes and 0 tax", async () => {
    const { createInvoiceJournalEntry } = await import("@/lib/services/accounting.service");

    // Seed dummy client and invoice with items having custom revenue codes
    const client = await db.client.create({
      data: {
        name: "Invoice Test Client",
        organizationId: testOrgId,
      },
    });

    const project = await db.project.create({
      data: {
        number: "PRJ-INV-001",
        name: "Test Project",
        organization: { connect: { id: testOrgId } },
        client: { connect: { id: client.id } },
      },
    });

    const invNumber = "INV-ITEM-REV-001";
    await db.invoice.create({
      data: {
        number: invNumber,
        subtotal: 8000,
        tax: 0,
        total: 8000,
        issueDate: new Date(),
        dueDate: new Date(),
        organization: { connect: { id: testOrgId } },
        client: { connect: { id: client.id } },
        project: { connect: { id: project.id } },
        items: {
          create: [
            { description: "Design Fee", quantity: 1, unitPrice: 5000, total: 5000, revenueCode: "4010" },
            { description: "Supervision Fee", quantity: 1, unitPrice: 3000, total: 3000, revenueCode: "4020" },
          ],
        },
      },
    });

    await db.$transaction(async (tx) => {
      await createInvoiceJournalEntry(tx, testOrgId, invNumber, 8000, 0, testUserId);
    });

    const entry = await db.journalEntry.findFirst({
      where: { reference: invNumber, organizationId: testOrgId },
      include: { lines: { include: { account: true } } },
    });

    expect(entry).toBeDefined();
    expect(entry?.lines.length).toBe(3); // AR (8000 Dr), 4010 (5000 Cr), 4020 (3000 Cr)

    const rev4010 = entry?.lines.find((l) => l.account.code === "4010");
    const rev4020 = entry?.lines.find((l) => l.account.code === "4020");

    expect(Number(rev4010?.credit)).toBe(5000);
    expect(Number(rev4020?.credit)).toBe(3000);
  });

  it("8. should auto-create journal entries for payments (bank vs cash)", async () => {
    const { createPaymentJournalEntry } = await import("@/lib/services/accounting.service");
    const invNumber = "INV-TEST-VAT-001";

    // Bank Payment: 5,000 AED
    await db.$transaction(async (tx) => {
      await createPaymentJournalEntry(tx, testOrgId, invNumber, 5000, "bank", testUserId);
    });

    // Cash Payment: 2,000 AED
    await db.$transaction(async (tx) => {
      await createPaymentJournalEntry(tx, testOrgId, invNumber, 2000, "cash", testUserId);
    });

    const entries = await db.journalEntry.findMany({
      where: { reference: `PAYMENT-${invNumber}`, organizationId: testOrgId },
      include: { lines: { include: { account: true } } },
    });

    expect(entries.length).toBe(2);

    const bankEntry = entries.find((e) => e.lines.some((l) => l.account.code === "1020"));
    const cashEntry = entries.find((e) => e.lines.some((l) => l.account.code === "1010"));

    expect(bankEntry).toBeDefined();
    expect(cashEntry).toBeDefined();

    // Verify AR is credited in both entries
    const bankArLine = bankEntry?.lines.find((l) => l.account.code === "1100");
    expect(Number(bankArLine?.credit)).toBe(5000);

    const cashArLine = cashEntry?.lines.find((l) => l.account.code === "1100");
    expect(Number(cashArLine?.credit)).toBe(2000);
  });

  it("9. should throw error when invoice journal entry accounts do not exist", async () => {
    const { createInvoiceJournalEntry } = await import("@/lib/services/accounting.service");
    const invalidOrgId = "org-non-existent";

    await expect(
      db.$transaction(async (tx) => {
        await createInvoiceJournalEntry(tx, invalidOrgId, "INV-ERR", 1000, 50, testUserId);
      })
    ).rejects.toThrow(/Run seedAccounts first/);
  });

  it("10. should validate negative and double debit/credit lines in journal entry", async () => {
    const accounts = await AccountingService.getAccounts(testOrgId);
    const bankAccount = accounts.find((a) => a.code === "1020")!;

    // Negative value check
    await expect(
      AccountingService.createJournalEntry(
        testOrgId,
        {
          description: "Negative check",
          lines: [
            { accountId: bankAccount.id, debit: -100, credit: 0 },
            { accountId: bankAccount.id, debit: 0, credit: -100 },
          ],
        },
        testUserId
      )
    ).rejects.toThrow(/non-negative/);

    // Both debit and credit in single line check
    await expect(
      AccountingService.createJournalEntry(
        testOrgId,
        {
          description: "Both debit & credit check",
          lines: [
            { accountId: bankAccount.id, debit: 100, credit: 100 },
            { accountId: bankAccount.id, debit: 0, credit: 0 },
          ],
        },
        testUserId
      )
    ).rejects.toThrow(/cannot contain both debit and credit/);
  });

  it("11. should post GL entry on markAsSent and reverse it atomically on cancelInvoice", async () => {
    const { invoiceService } = await import("@/lib/services/invoice.service");

    // Create client and project for invoice
    const client = await db.client.create({
      data: {
        id: "client-reversal-test",
        name: "Reversal Client",
        idNumber: "CL-REV-TEST-001",
        email: "client-reversal@test.com",
        phone: "+971509998877",
        organizationId: testOrgId,
      },
    });

    const project = await db.project.create({
      data: {
        id: "project-reversal-test",
        name: "Reversal Project",
        number: "PRJ-REV-001",
        clientId: client.id,
        organizationId: testOrgId,
      },
    });

    const invoice = await invoiceService.createInvoice(
      {
        clientId: client.id,
        projectId: project.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        items: [
          {
            description: "Consultancy Services",
            quantity: 1,
            unitPrice: 2000,
            total: 2000,
            revenueCode: "4010",
          },
        ],
      },
      testOrgId,
      testUserId
    );

    // 1. Mark as sent -> should create AR journal entry
    const sentInvoice = await invoiceService.markAsSent(invoice.id, testOrgId, testUserId);
    expect(sentInvoice.status).toBe("SENT");

    const sentEntry = await db.journalEntry.findFirst({
      where: { organizationId: testOrgId, reference: invoice.number },
      include: { lines: true },
    });
    expect(sentEntry).not.toBeNull();

    // 2. Cancel invoice -> should flip status to CANCELLED and create REV- entry
    const cancelledInvoice = await invoiceService.cancelInvoice(invoice.id, testOrgId, testUserId);
    expect(cancelledInvoice.status).toBe("CANCELLED");

    const revEntry = await db.journalEntry.findFirst({
      where: { organizationId: testOrgId, reference: `REV-${invoice.number}` },
      include: { lines: true },
    });
    expect(revEntry).not.toBeNull();
  }, 15000);
});
