// @ts-check
// Server-side PDF generation for BluePrint reports
// This file should only be imported in server components/API routes
// Uses dynamic imports for jspdf to avoid client-side bundling issues

import { db } from '@/lib/db';
import type { JsPdfCache } from '@/types/pdf-types';
import { setupArabicPdf, preprocessArabicText } from './arabic-helper';
import { formatCurrency as formatCurrencyMulti } from '@/lib/currency';


// Types for report data
export interface FinancialReportData {
  title: string;
  dateRange: string;
  summary: {
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
  rows: Array<{
    date: string;
    invoiced: number;
    paid: number;
    pending: number;
  }>;
  currency: string;
  language: 'ar' | 'en';
}

export interface ProjectReportData {
  title: string;
  dateRange: string;
  summary: {
    total: number;
    active: number;
    completed: number;
    pending: number;
    onHold: number;
  };
  projects: Array<{
    name: string;
    client: string;
    status: string;
    progress: number;
    budget: number;
  }>;
  language: 'ar' | 'en';
}

export interface TaskReportData {
  title: string;
  dateRange: string;
  summary: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
  };
  tasks: Array<{
    title: string;
    project: string;
    status: string;
    priority: string;
    dueDate: string;
    assignee?: string;
  }>;
  language: 'ar' | 'en';
}

export interface ClientReportData {
  title: string;
  dateRange: string;
  summary: {
    total: number;
    active: number;
    totalRevenue: number;
  };
  clients: Array<{
    name: string;
    email: string;
    phone: string;
    contactPerson?: string;
    totalInvoiced: number;
    totalPaid: number;
  }>;
  currency: string;
  language: 'ar' | 'en';
}

export interface InvoiceReportData {
  title: string;
  dateRange: string;
  summary: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
  };
  invoices: Array<{
    invoiceNumber: string;
    client: string;
    project?: string;
    total: number;
    paidAmount?: number;
    status: string;
    issueDate?: string;
    dueDate: string;
  }>;
  currency: string;
  language: 'ar' | 'en';
}

// Cache for loaded modules
let jspdfCache: JsPdfCache | null = null;

// Dynamic import for server-side only with caching
async function getJsPDF() {
  if (jspdfCache) {
    return jspdfCache;
  }

  const jspdfModule = await import('jspdf');
  const autotableModule = await import('jspdf-autotable');

  jspdfCache = {
    jsPDF: jspdfModule.default,
    autoTable: autotableModule.default,
  };

  return jspdfCache;
}

// Format number with thousand separators
function _formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// Format currency with multi-currency support
function formatCurrency(amount: number, currency: string, language: 'ar' | 'en' = 'en'): string {
  return formatCurrencyMulti(amount, currency, language);
}

// Get status label in appropriate language
function getStatusLabel(status: string, language: 'ar' | 'en'): string {
  const labels: Record<string, Record<string, string>> = {
    ACTIVE: { ar: 'نشط', en: 'Active' },
    COMPLETED: { ar: 'مكتمل', en: 'Completed' },
    PENDING: { ar: 'معلق', en: 'Pending' },
    'ON_HOLD': { ar: 'متوقف', en: 'On Hold' },
    'ON_HOLD_ALT': { ar: 'متوقف', en: 'On Hold' },
    'IN_PROGRESS': { ar: 'قيد التنفيذ', en: 'In Progress' },
    TODO: { ar: 'للتنفيذ', en: 'To Do' },
    DONE: { ar: 'منجز', en: 'Done' },
    PAID: { ar: 'مدفوع', en: 'Paid' },
    OVERDUE: { ar: 'متأخر', en: 'Overdue' },
    DRAFT: { ar: 'مسودة', en: 'Draft' },
    SENT: { ar: 'مرسلة', en: 'Sent' },
    PARTIALLY_PAID: { ar: 'مدفوعة جزئياً', en: 'Partially Paid' },
    CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
    DELAYED: { ar: 'متأخر', en: 'Delayed' },
  };
  return labels[status]?.[language] || status;
}

// Get priority label
function getPriorityLabel(priority: string, language: 'ar' | 'en'): string {
  const labels: Record<string, Record<string, string>> = {
    CRITICAL: { ar: 'حرج', en: 'Critical' },
    HIGH: { ar: 'عالي', en: 'High' },
    URGENT: { ar: 'عاجل', en: 'Urgent' },
    MEDIUM: { ar: 'متوسط', en: 'Medium' },
    NORMAL: { ar: 'عادي', en: 'Normal' },
    LOW: { ar: 'منخفض', en: 'Low' },
  };
  return labels[priority]?.[language] || priority;
}

// Add page footer
function addFooter(doc: import('jspdf').jsPDF, pageCount: number, isRTL: boolean, customFooter?: string) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);

    // Left or right side text (branding/pagination)
    const paginationText = isRTL
      ? `BluePrint - صفحة ${i} من ${pageCount}`
      : `BluePrint - Page ${i} of ${pageCount}`;
    doc.text(paginationText, isRTL ? 280 : 14, doc.internal.pageSize.height - 10, {
      align: isRTL ? 'right' : 'left',
    });

    // Center text (Custom Footer)
    if (customFooter) {
      doc.text(customFooter, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, {
        align: 'center',
      });
    }
  }
}

// Add page header
function addHeader(doc: import('jspdf').jsPDF, isRTL: boolean, customHeader?: string) {
  if (customHeader) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(customHeader, doc.internal.pageSize.width / 2, 10, {
      align: 'center',
    });
  }
}

// Teal accent color matching BluePrint branding
const TEAL = [20, 184, 166] as [number, number, number];

// ===== Financial Report PDF =====
export async function generateFinancialReportPDF(data: FinancialReportData): Promise<Buffer> {
  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF('landscape');
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const isRTL = data.language === 'ar';
  const settings = await getCompanySettings();

  addHeader(doc, isRTL, settings.pdfHeader);

  // Title
  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(data.title, isRTL ? 280 : 14, 20, { align: isRTL ? 'right' : 'left' });

  // Date range
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(data.dateRange, isRTL ? 280 : 14, 30, { align: isRTL ? 'right' : 'left' });

  // Summary section
  const summaryY = 45;
  const summaryItems = [
    { label: isRTL ? 'إجمالي الفواتير' : 'Total Invoiced', value: formatCurrency(data.summary.totalInvoiced, data.currency, data.language) },
    { label: isRTL ? 'المبالغ المحصلة' : 'Collected Amount', value: formatCurrency(data.summary.totalPaid, data.currency, data.language) },
    { label: isRTL ? 'المبالغ المعلقة' : 'Pending Amount', value: formatCurrency(data.summary.totalPending, data.currency, data.language) },
    { label: isRTL ? 'المبالغ المتأخرة' : 'Overdue Amount', value: formatCurrency(data.summary.totalOverdue, data.currency, data.language) },
  ];

  summaryItems.forEach((item, index) => {
    const x = isRTL ? 280 : 14;
    const xOffset = isRTL ? -(index * 70) : index * 70;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + xOffset, summaryY, { align: isRTL ? 'right' : 'left' });
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(item.value, x + xOffset, summaryY + 6, { align: isRTL ? 'right' : 'left' });
  });

  // Table
  const tableHeaders = isRTL
    ? [['التاريخ', 'الفواتير', 'المدفوعات', 'المتأخرات']]
    : [['Date', 'Invoiced', 'Paid', 'Pending']];

  const tableData = data.rows.map(row => [
    row.date,
    formatCurrency(row.invoiced, data.currency, data.language),
    formatCurrency(row.paid, data.currency, data.language),
    formatCurrency(row.pending, data.currency, data.language),
  ]);

  autoTable(doc, {
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData.map(row => row.map(cell => preprocessArabicText(cell))),
    startY: summaryY + 20,
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontSize: 11,
      halign: isRTL ? 'right' : 'left',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 41, 59],
      halign: isRTL ? 'right' : 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: isRTL ? {
      0: { halign: 'right' },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    } : {},
  });

  addFooter(doc, doc.getNumberOfPages(), isRTL, settings.pdfFooter);
  return Buffer.from(doc.output('arraybuffer'));
}


// ===== Project Report PDF =====
export async function generateProjectReportPDF(data: ProjectReportData): Promise<Buffer> {
  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF('landscape');
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const isRTL = data.language === 'ar';
  const settings = await getCompanySettings();

  addHeader(doc, isRTL, settings.pdfHeader);

  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(data.title, isRTL ? 280 : 14, 20, { align: isRTL ? 'right' : 'left' });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(data.dateRange, isRTL ? 280 : 14, 30, { align: isRTL ? 'right' : 'left' });

  const summaryY = 45;
  const summaryItems = [
    { label: isRTL ? 'إجمالي المشاريع' : 'Total Projects', value: data.summary.total.toString() },
    { label: isRTL ? 'نشط' : 'Active', value: data.summary.active.toString() },
    { label: isRTL ? 'مكتمل' : 'Completed', value: data.summary.completed.toString() },
    { label: isRTL ? 'معلق' : 'Pending', value: data.summary.pending.toString() },
  ];

  summaryItems.forEach((item, index) => {
    const x = isRTL ? 280 : 14;
    const xOffset = isRTL ? -(index * 70) : index * 70;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + xOffset, summaryY, { align: isRTL ? 'right' : 'left' });
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(item.value, x + xOffset, summaryY + 6, { align: isRTL ? 'right' : 'left' });
  });

  const tableHeaders = isRTL
    ? [['المشروع', 'العميل', 'الحالة', 'التقدم', 'الميزانية']]
    : [['Project', 'Client', 'Status', 'Progress', 'Budget']];

  const tableData = data.projects.map(p => [
    p.name,
    p.client,
    getStatusLabel(p.status, data.language),
    `${p.progress}%`,
    formatCurrency(p.budget, settings.currency || 'AED', data.language),
  ]);

  autoTable(doc, {
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData.map(row => row.map(cell => preprocessArabicText(cell))),
    startY: summaryY + 20,
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontSize: 11,
      halign: isRTL ? 'right' : 'left',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 41, 59],
      halign: isRTL ? 'right' : 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });


  addFooter(doc, doc.getNumberOfPages(), isRTL, settings.pdfFooter);
  return Buffer.from(doc.output('arraybuffer'));
}

// ===== Task Report PDF =====
export async function generateTaskReportPDF(data: TaskReportData): Promise<Buffer> {
  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF('landscape');
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const isRTL = data.language === 'ar';
  const settings = await getCompanySettings();

  addHeader(doc, isRTL, settings.pdfHeader);

  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(data.title, isRTL ? 280 : 14, 20, { align: isRTL ? 'right' : 'left' });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(data.dateRange, isRTL ? 280 : 14, 30, { align: isRTL ? 'right' : 'left' });

  const summaryY = 45;
  const summaryItems = [
    { label: isRTL ? 'إجمالي المهام' : 'Total Tasks', value: data.summary.total.toString() },
    { label: isRTL ? 'للتنفيذ' : 'To Do', value: data.summary.todo.toString() },
    { label: isRTL ? 'قيد التنفيذ' : 'In Progress', value: data.summary.inProgress.toString() },
    { label: isRTL ? 'منجز' : 'Done', value: data.summary.done.toString() },
    { label: isRTL ? 'متأخر' : 'Overdue', value: data.summary.overdue.toString() },
  ];

  summaryItems.forEach((item, index) => {
    const x = isRTL ? 280 : 14;
    const xOffset = isRTL ? -(index * 55) : index * 55;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + xOffset, summaryY, { align: isRTL ? 'right' : 'left' });
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(item.value, x + xOffset, summaryY + 6, { align: isRTL ? 'right' : 'left' });
  });

  const tableHeaders = isRTL
    ? [['المهمة', 'المشروع', 'الحالة', 'الأولوية', 'تاريخ الاستحقاق', 'المسؤول']]
    : [['Task', 'Project', 'Status', 'Priority', 'Due Date', 'Assignee']];

  const tableData = data.tasks.map(t => [
    t.title,
    t.project,
    getStatusLabel(t.status, data.language),
    getPriorityLabel(t.priority, data.language),
    t.dueDate,
    t.assignee || '-',
  ]);

  autoTable(doc, {
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData.map(row => row.map(cell => preprocessArabicText(cell))),
    startY: summaryY + 20,
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontSize: 11,
      halign: isRTL ? 'right' : 'left',
    },
    bodyStyles: {

      fontSize: 10,
      textColor: [30, 41, 59],
      halign: isRTL ? 'right' : 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  addFooter(doc, doc.getNumberOfPages(), isRTL, settings.pdfFooter);
  return Buffer.from(doc.output('arraybuffer'));
}

// ===== Client Report PDF =====
export async function generateClientReportPDF(data: ClientReportData): Promise<Buffer> {
  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF('landscape');
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const isRTL = data.language === 'ar';
  const settings = await getCompanySettings();

  addHeader(doc, isRTL, settings.pdfHeader);

  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(data.title, isRTL ? 280 : 14, 20, { align: isRTL ? 'right' : 'left' });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(data.dateRange, isRTL ? 280 : 14, 30, { align: isRTL ? 'right' : 'left' });

  const summaryY = 45;
  const summaryItems = [
    { label: isRTL ? 'إجمالي العملاء' : 'Total Clients', value: data.summary.total.toString() },
    { label: isRTL ? 'العملاء النشطون' : 'Active Clients', value: data.summary.active.toString() },
    { label: isRTL ? 'إجمالي الإيرادات' : 'Total Revenue', value: formatCurrency(data.summary.totalRevenue, data.currency, data.language) },
  ];

  summaryItems.forEach((item, index) => {
    const x = isRTL ? 280 : 14;
    const xOffset = isRTL ? -(index * 90) : index * 90;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + xOffset, summaryY, { align: isRTL ? 'right' : 'left' });
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(item.value, x + xOffset, summaryY + 6, { align: isRTL ? 'right' : 'left' });
  });

  const tableHeaders = isRTL
    ? [['الاسم', 'البريد الإلكتروني', 'الهاتف', 'إجمالي الفواتير', 'إجمالي المدفوعات']]
    : [['Name', 'Email', 'Phone', 'Total Invoiced', 'Total Paid']];

  const tableData = data.clients.map(c => [
    c.name,
    c.email || '-',
    c.phone || '-',
    formatCurrency(c.totalInvoiced, data.currency, data.language),
    formatCurrency(c.totalPaid, data.currency, data.language),
  ]);

  autoTable(doc, {
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData.map(row => row.map(cell => preprocessArabicText(cell))),
    startY: summaryY + 20,
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontSize: 11,
      halign: isRTL ? 'right' : 'left',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 41, 59],
      halign: isRTL ? 'right' : 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  addFooter(doc, doc.getNumberOfPages(), isRTL, settings.pdfFooter);
  return Buffer.from(doc.output('arraybuffer'));
}

// ===== Invoice Report PDF =====
export async function generateInvoiceReportPDF(data: InvoiceReportData): Promise<Buffer> {
  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF('landscape');
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const isRTL = data.language === 'ar';
  const settings = await getCompanySettings();

  addHeader(doc, isRTL, settings.pdfHeader);

  doc.setFontSize(20);
  doc.setTextColor(...TEAL);
  doc.text(data.title, isRTL ? 280 : 14, 20, { align: isRTL ? 'right' : 'left' });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(data.dateRange, isRTL ? 280 : 14, 30, { align: isRTL ? 'right' : 'left' });

  const summaryY = 45;
  const summaryItems = [
    { label: isRTL ? 'إجمالي الفواتير' : 'Total Invoices', value: data.summary.total.toString() },
    { label: isRTL ? 'مدفوعة' : 'Paid', value: data.summary.paid.toString() },
    { label: isRTL ? 'معلقة' : 'Pending', value: data.summary.pending.toString() },
    { label: isRTL ? 'متأخرة' : 'Overdue', value: data.summary.overdue.toString() },
  ];

  summaryItems.forEach((item, index) => {
    const x = isRTL ? 280 : 14;
    const xOffset = isRTL ? -(index * 70) : index * 70;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + xOffset, summaryY, { align: isRTL ? 'right' : 'left' });
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(item.value, x + xOffset, summaryY + 6, { align: isRTL ? 'right' : 'left' });
  });

  const tableHeaders = isRTL
    ? [['رقم الفاتورة', 'العميل', 'المشروع', 'المبلغ', 'المدفوع', 'الحالة', 'تاريخ الاستحقاق']]
    : [['Invoice #', 'Client', 'Project', 'Amount', 'Paid', 'Status', 'Due Date']];

  const tableData = data.invoices.map(inv => [
    inv.invoiceNumber,
    inv.client,
    inv.project || '-',
    formatCurrency(inv.total, data.currency, data.language),
    formatCurrency(inv.paidAmount || 0, data.currency, data.language),
    getStatusLabel(inv.status, data.language),
    inv.dueDate,
  ]);

  autoTable(doc, {
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData.map(row => row.map(cell => preprocessArabicText(cell))),
    startY: summaryY + 20,
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontSize: 11,
      halign: isRTL ? 'right' : 'left',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 41, 59],
      halign: isRTL ? 'right' : 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  addFooter(doc, doc.getNumberOfPages(), isRTL, settings.pdfFooter);
  return Buffer.from(doc.output('arraybuffer'));
}


// ===== Helper: Fetch company settings =====
export async function getCompanySettings(organizationId?: string) {
  const settings = await db.companySettings.findFirst(organizationId ? { where: { organizationId } } : undefined);
  return {
    name: settings?.name || 'BluePrint Engineering',
    nameEn: settings?.nameEn || 'BluePrint Engineering',
    email: settings?.email || '',
    phone: settings?.phone || '',
    address: settings?.address || '',
    taxNumber: settings?.taxNumber || '',
    currency: settings?.currency || 'AED',
    pdfHeader: '',
    pdfFooter: '',
  };
}
