// Server-side Invoice PDF generator
// Fetches invoice data from DB and generates a professional PDF

import { db } from '@/lib/db';
import type { JsPdfCache } from '@/types/pdf-types';
import { setupArabicPdf, preprocessArabicText } from './arabic-helper';

let jspdfCache: JsPdfCache | null = null;

async function getJsPDF() {
  if (jspdfCache) return jspdfCache;
  const jspdfModule = await import('jspdf');
  const autotableModule = await import('jspdf-autotable');
  jspdfCache = { jsPDF: jspdfModule.default, autoTable: autotableModule.default };
  return jspdfCache;
}

function formatCurrency(amount: number, currencyCode: string = 'AED'): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
}

/**
 * Format the tax rate for the VAT label from the invoice's own taxRate column
 * (PERCENT convention: 5 -> "5%", 5.5 -> "5.5%"). Never hardcode 5% — a
 * zero-rated or custom-rate invoice must print its real rate (FTA requirement).
 * Accepts Prisma Decimal values via Number() coercion at the call site.
 */
function formatTaxRateLabel(taxRate: number, lang: 'ar' | 'en'): string {
  const rateStr = (Number(taxRate) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return lang === 'ar' ? `ضريبة القيمة المضافة (${rateStr}%)` : `VAT (${rateStr}%)`;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TEAL = [20, 184, 166] as [number, number, number];

export async function generateInvoicePDFBuffer(invoiceId: string, lang: 'ar' | 'en' = 'en'): Promise<Buffer> {
  // Fetch invoice with relations
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      project: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Fetch company settings — SECURITY: scoped to the invoice's organization.
  // The previous findFirst() without a filter could print ANOTHER tenant's
  // company name/address/TRN on this tax invoice (cross-tenant data leak).
  // The caller has already verified the invoice belongs to the requesting
  // user's organization, so invoice.organizationId is the trusted scope.
  const settings = await db.companySettings.findFirst({
    where: { organizationId: invoice.organizationId },
  });
  const orgCurrency = settings?.currency || 'AED';
  const orgName = lang === 'ar' ? (settings?.name || 'BluePrint') : (settings?.nameEn || 'BluePrint Engineering');

  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // ===== HEADER =====
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('Cairo', 'bold');

  doc.text(orgName, margin, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(lang === 'ar' ? 'مكتب الاستشارات الهندسية' : 'Engineering Consultancy Office', margin, 22);
  doc.setFontSize(8);
  doc.setTextColor(200, 240, 235);
  doc.text(settings?.address || 'United Arab Emirates', margin, 27);

  // Invoice label on right
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(lang === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice', pageWidth - margin, 15, { align: 'right' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.number, pageWidth - margin, 24, { align: 'right' });

  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    PAID: [34, 197, 94],
    PARTIALLY_PAID: [234, 179, 8],
    OVERDUE: [239, 68, 68],
    DRAFT: [100, 116, 139],
    SENT: [20, 184, 166],
    CANCELLED: [100, 116, 139],
  };
  const statusLabels: Record<string, Record<string, string>> = {
    DRAFT: { ar: 'مسودة', en: 'Draft' },
    SENT: { ar: 'مرسلة', en: 'Sent' },
    PARTIALLY_PAID: { ar: 'مدفوعة جزئياً', en: 'Partially Paid' },
    PAID: { ar: 'مدفوعة', en: 'Paid' },
    OVERDUE: { ar: 'متأخرة', en: 'Overdue' },
    CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
  };

  doc.setFontSize(9);
  doc.setTextColor(...(statusColors[invoice.status] || [100, 116, 139]));
  doc.text(statusLabels[invoice.status]?.[lang] || invoice.status, pageWidth - margin, 30, { align: 'right' });

  // ===== CLIENT & DATES SECTION =====
  let y = 45;

  // Client info
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(lang === 'ar' ? 'معلومات العميل' : 'CLIENT INFORMATION', margin, y);

  y += 6;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.client.name, margin, y);

  if (invoice.client.company) {
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(invoice.client.company, margin, y);
  }

  if (invoice.client.email) {
    y += 5;
    doc.setFontSize(9);
    doc.text(invoice.client.email, margin, y);
  }

  // Buyer TRN — required on UAE tax invoices for registered buyers (FTA)
  if (invoice.client.taxNumber) {
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${lang === 'ar' ? 'الرقم الضريبي للعميل' : 'Buyer TRN'}: ${invoice.client.taxNumber}`, margin, y);
  }

  // Invoice details (right side)
  let rightY = 45;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(lang === 'ar' ? 'تفاصيل الفاتورة' : 'INVOICE DETAILS', pageWidth - margin, rightY, { align: 'right' });

  rightY += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.setTextColor(100, 116, 139);
  doc.text(lang === 'ar' ? 'تاريخ الإصدار:' : 'Issue Date:', pageWidth - margin - 40, rightY, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(invoice.issueDate), pageWidth - margin, rightY, { align: 'right' });

  rightY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(lang === 'ar' ? 'تاريخ الاستحقاق:' : 'Due Date:', pageWidth - margin - 40, rightY, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(invoice.dueDate), pageWidth - margin, rightY, { align: 'right' });

  rightY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(lang === 'ar' ? 'المشروع:' : 'Project:', pageWidth - margin - 40, rightY, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text((lang === 'ar' ? invoice.project?.name : invoice.project?.nameEn) || invoice.project?.name || '-', pageWidth - margin, rightY, { align: 'right' });

  // Divider
  y = Math.max(y, rightY) + 8;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // ===== LINE ITEMS TABLE =====
  y += 8;
  const tableHeaders = lang === 'ar'
    ? [['#', 'الوصف', 'الكمية', 'سعر الوحدة', 'الإجمالي']]
    : [['#', 'Description', 'Qty', 'Unit Price', 'Total']];

  const tableData = invoice.items.map((item, idx) => [
    (idx + 1).toString(),
    preprocessArabicText(item.description || '-'),
    item.quantity.toLocaleString(),
    formatCurrency(Number(item.unitPrice), orgCurrency),
    formatCurrency(Number(item.total), orgCurrency),
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {

      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
    },
  });

  // ===== TOTALS SECTION =====
  const finalY = doc.lastAutoTable?.finalY || y + 50;
  let totalsY = finalY + 8;

  const totalsBoxWidth = 90;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsBoxX, totalsY - 4, totalsBoxWidth, 38, 2, 2, 'F');

  // Subtotal
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(lang === 'ar' ? 'المجموع الفرعي' : 'Subtotal', pageWidth - margin - 30, totalsY + 2, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(Number(invoice.subtotal), orgCurrency), pageWidth - margin, totalsY + 2, { align: 'right' });

  // VAT — rate comes from the invoice itself, not a hardcoded 5%
  totalsY += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(formatTaxRateLabel(Number(invoice.taxRate), lang), pageWidth - margin - 30, totalsY + 2, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(Number(invoice.tax), orgCurrency), pageWidth - margin, totalsY + 2, { align: 'right' });

  // Grand Total
  totalsY += 9;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.8);
  doc.line(pageWidth - margin - totalsBoxWidth + 5, totalsY - 3, pageWidth - margin, totalsY - 3);

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(lang === 'ar' ? 'الإجمالي الكلي' : 'Grand Total', pageWidth - margin - 30, totalsY + 2, { align: 'right' });
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(Number(invoice.total), orgCurrency), pageWidth - margin, totalsY + 2, { align: 'right' });

  // Paid amount & balance
  if (Number(invoice.paidAmount) > 0) {
    totalsY += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(lang === 'ar' ? 'المبلغ المدفوع:' : 'Amount Paid:', pageWidth - margin - 30, totalsY, { align: 'right' });
    doc.text(formatCurrency(Number(invoice.paidAmount), orgCurrency), pageWidth - margin, totalsY, { align: 'right' });

    totalsY += 6;
    const balance = Number(invoice.total) - Number(invoice.paidAmount);
    doc.setTextColor(balance > 0 ? 234 : 34, balance > 0 ? 179 : 197, balance > 0 ? 8 : 94);
    doc.text(lang === 'ar' ? 'المبلغ المستحق:' : 'Balance Due:', pageWidth - margin - 30, totalsY, { align: 'right' });
    doc.text(formatCurrency(balance, orgCurrency), pageWidth - margin, totalsY, { align: 'right' });
  }

  // Tax number
  if (settings?.taxNumber) {
    totalsY += 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${lang === 'ar' ? 'الرقم الضريبي' : 'Tax No.'}: ${settings.taxNumber}`,
      pageWidth - margin,
      totalsY,
      { align: 'right' }
    );
  }

  // ===== FOOTER =====
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(lang === 'ar' ? 'شكراً لتعاملكم معنا' : 'Thank you for your business', pageWidth / 2, pageHeight - 18, { align: 'center' });
  doc.text(`${orgName} - UAE`, pageWidth / 2, pageHeight - 12, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
