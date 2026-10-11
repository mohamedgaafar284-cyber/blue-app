// Server-side Proposal PDF generator
// Fetches proposal data from DB and generates a professional PDF

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

function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TEAL = [20, 184, 166] as [number, number, number];

const STATUS_LABELS: Record<string, Record<string, string>> = {
  DRAFT: { ar: 'مسودة', en: 'Draft' },
  SENT: { ar: 'مرسلة', en: 'Sent' },
  ACCEPTED: { ar: 'مقبول', en: 'Accepted' },
  REJECTED: { ar: 'مرفوض', en: 'Rejected' },
  EXPIRED: { ar: 'منتهي الصلاحية', en: 'Expired' },
};

export async function generateProposalPDFBuffer(proposalId: string, lang: 'ar' | 'en' = 'ar'): Promise<Buffer> {
  // Fetch proposal with relations
  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: {
      client: true,
      project: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  // Fetch company settings — SECURITY: scoped to the proposal's organization
  // (the caller already verified the proposal belongs to the requesting org).
  // An unfiltered findFirst() could print ANOTHER tenant's company identity.
  const settings = await db.companySettings.findFirst({
    where: { organizationId: proposal.organizationId },
  });
  const orgName = lang === 'ar' ? (settings?.name || 'BluePrint') : (settings?.nameEn || 'BluePrint Engineering');

  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Set up dynamic font and Arabic auto-reshaping/RTL formatting
  await setupArabicPdf(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;


  const isRTL = lang === 'ar';

  const t = {
    proposal: isRTL ? 'عرض سعر' : 'PROPOSAL',
    proposalNumber: isRTL ? 'رقم العرض' : 'Proposal No.',
    date: isRTL ? 'التاريخ' : 'Date',
    status: isRTL ? 'الحالة' : 'Status',
    to: isRTL ? 'إلى' : 'To',
    project: isRTL ? 'المشروع' : 'Project',
    description: isRTL ? 'الوصف' : 'Description',
    quantity: isRTL ? 'الكمية' : 'Qty',
    unitPrice: isRTL ? 'سعر الوحدة' : 'Unit Price',
    total: isRTL ? 'الإجمالي' : 'Total',
    subtotal: isRTL ? 'المجموع الفرعي' : 'Subtotal',
    tax: isRTL ? 'الضريبة (5%)' : 'Tax (5%)',
    grandTotal: isRTL ? 'الإجمالي الكلي' : 'Grand Total',
    notes: isRTL ? 'ملاحظات' : 'Notes',
    thankYou: isRTL ? 'شكراً لاهتمامكم بعرضنا' : 'Thank you for considering our proposal',
    contactUs: isRTL ? 'للاستفسارات يرجى التواصل معنا' : 'For inquiries, please contact us',
    page: isRTL ? 'صفحة' : 'Page',
    of: isRTL ? 'من' : 'of',
  };

  // ===== HEADER =====
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName, isRTL ? pageWidth - margin : margin, 18, {
    align: isRTL ? 'right' : 'left',
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const orgContact = [settings?.phone, settings?.email].filter(Boolean).join(' | ');
  if (orgContact) {
    doc.text(orgContact, isRTL ? pageWidth - margin : margin, 28, {
      align: isRTL ? 'right' : 'left',
    });
  }

  yPos = 50;

  // ===== PROPOSAL TITLE =====
  doc.setTextColor(99, 102, 241);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(t.proposal, pageWidth / 2, yPos, { align: 'center' });

  yPos += 10;

  // Proposal number + status
  doc.setFillColor(241, 245, 249);
  const badgeWidth = 70;
  doc.roundedRect((pageWidth - badgeWidth) / 2, yPos - 4, badgeWidth, 10, 2, 2, 'F');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  const statusText = STATUS_LABELS[proposal.status]?.[lang] || proposal.status;
  doc.text(`#${proposal.number} - ${statusText}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // ===== CLIENT & DATE INFO =====
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t.to + ':', margin, yPos);

  yPos += 5;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text(proposal.client.name, margin, yPos);

  if (proposal.client.company) {
    yPos += 4;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(proposal.client.company, margin, yPos);
  }

  if (proposal.client.email) {
    yPos += 4;
    doc.text(proposal.client.email, margin, yPos);
  }

  // Right side - dates
  let rightY = yPos - 13;
  const rightCol = pageWidth / 2 + 10;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t.date + ':', rightCol, rightY);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(proposal.createdAt), rightCol + 25, rightY);

  if (proposal.project) {
    rightY += 5;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.text(t.project + ':', rightCol, rightY);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    const projName = lang === 'ar' ? proposal.project.name : (proposal.project.nameEn || proposal.project.name);
    doc.text(projName.substring(0, 25), rightCol + 25, rightY);
  }

  yPos = Math.max(yPos, rightY) + 15;

  // ===== ITEMS TABLE =====
  const tableHeaders = isRTL
    ? [['#', t.description, t.quantity, t.unitPrice, t.total]]
    : [['#', t.description, t.quantity, t.unitPrice, t.total]];

  const proposalCurrency = settings?.currency || 'AED';

  const tableData = proposal.items.map((item, idx) => [
    (idx + 1).toString(),
    preprocessArabicText(item.description),
    item.quantity.toLocaleString(),
    formatCurrency(Number(item.unitPrice), proposalCurrency),
    formatCurrency(Number(item.total), proposalCurrency),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: tableHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
    body: tableData,
    theme: 'striped',
    styles: {
      font: 'Cairo',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },

      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable?.finalY || yPos + 30;
  yPos += 10;

  // ===== TOTALS SECTION =====
  const totalsX = pageWidth - margin - 65;
  const totalsWidth = 60;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(totalsX - 5, yPos - 5, totalsWidth + 10, 32, 3, 3, 'F');

  yPos += 2;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(t.subtotal + ':', totalsX, yPos);
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(Number(proposal.subtotal), proposalCurrency), totalsX + totalsWidth, yPos, { align: 'right' });

  yPos += 6;
  doc.setTextColor(100, 116, 139);
  doc.text(t.tax, totalsX, yPos);
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(Number(proposal.tax), proposalCurrency), totalsX + totalsWidth, yPos, { align: 'right' });

  yPos += 8;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.8);
  doc.line(totalsX, yPos - 2, totalsX + totalsWidth, yPos - 2);

  doc.setFontSize(12);
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');
  doc.text(t.grandTotal + ':', totalsX, yPos);
  doc.text(formatCurrency(Number(proposal.total), proposalCurrency), totalsX + totalsWidth, yPos + 2, { align: 'right' });

  yPos += 15;

  // ===== NOTES SECTION =====
  if (proposal.notes) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }
    doc.setTextColor(...TEAL);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(t.notes, margin, yPos);

    yPos += 5;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(proposal.notes, pageWidth - 2 * margin);
    doc.text(notesLines.slice(0, 8), margin, yPos);
  }

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...TEAL);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(t.thankYou, pageWidth / 2, pageHeight - 15, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    if (settings?.email) {
      doc.text(`${t.contactUs}: ${settings.email}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    doc.text(`${t.page} ${i} ${t.of} ${pageCount}`, margin, pageHeight - 8);
  }

  return Buffer.from(doc.output('arraybuffer'));
}
