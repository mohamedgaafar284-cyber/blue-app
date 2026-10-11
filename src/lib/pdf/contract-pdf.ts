// @ts-check
// Server-side Contract PDF generator
// Fetches contract data from DB and generates a professional PDF

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

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

const TEAL = [20, 184, 166] as [number, number, number];

const CONTRACT_TYPE_LABELS: Record<string, Record<string, string>> = {
  ENGINEERING_SERVICES: { ar: 'خدمات هندسية', en: 'Engineering Services' },
  CONSTRUCTION: { ar: 'إنشائي', en: 'Construction' },
  CONSULTING: { ar: 'استشارات', en: 'Consulting' },
  MAINTENANCE: { ar: 'صيانة', en: 'Maintenance' },
  lump_sum: { ar: 'مقاولة بسعر إجمالي', en: 'Lump Sum' },
  unit_price: { ar: 'مقاولة بأسعار الوحدات', en: 'Unit Price' },
  cost_plus: { ar: 'مقاولة بالتكلفة زائد نسبة', en: 'Cost Plus' },
};

const STATUS_LABELS: Record<string, Record<string, string>> = {
  DRAFT: { ar: 'مسودة', en: 'Draft' },
  PENDING_SIGNATURE: { ar: 'بانتظار التوقيع', en: 'Pending Signature' },
  ACTIVE: { ar: 'نشط', en: 'Active' },
  EXPIRED: { ar: 'منتهي', en: 'Expired' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed' },
};

export async function generateContractPDFBuffer(contractId: string, lang: 'ar' | 'en' = 'ar'): Promise<Buffer> {
  // Fetch contract with relations
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      client: true,
      project: true,
      amendments: { orderBy: { date: 'asc' } },
    },
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Fetch company settings — SECURITY: scoped to the contract's organization
  // (the caller already verified the contract belongs to the requesting org).
  // An unfiltered findFirst() could print ANOTHER tenant's company identity.
  const settings = await db.companySettings.findFirst({
    where: { organizationId: contract.organizationId },
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


  const t = {
    contract: lang === 'ar' ? 'عقد' : 'CONTRACT',
    contractNumber: lang === 'ar' ? 'رقم العقد' : 'Contract No.',
    contractType: lang === 'ar' ? 'نوع العقد' : 'Contract Type',
    parties: lang === 'ar' ? 'أطراف العقد' : 'Contract Parties',
    firstParty: lang === 'ar' ? 'الطرف الأول (العميل)' : 'First Party (Client)',
    secondParty: lang === 'ar' ? 'الطرف الثاني (المكتب)' : 'Second Party (Consultancy)',
    projectDetails: lang === 'ar' ? 'تفاصيل المشروع' : 'Project Details',
    projectName: lang === 'ar' ? 'اسم المشروع' : 'Project Name',
    projectLocation: lang === 'ar' ? 'موقع المشروع' : 'Project Location',
    contractValue: lang === 'ar' ? 'قيمة العقد' : 'Contract Value',
    contractPeriod: lang === 'ar' ? 'مدة العقد' : 'Contract Period',
    startDate: lang === 'ar' ? 'تاريخ البدء' : 'Start Date',
    endDate: lang === 'ar' ? 'تاريخ الانتهاء' : 'End Date',
    amendments: lang === 'ar' ? 'التعديلات' : 'Amendments',
    signatures: lang === 'ar' ? 'التوقيعات' : 'Signatures',
    clientSignature: lang === 'ar' ? 'توقيع العميل' : 'Client Signature',
    contractorSignature: lang === 'ar' ? 'توقيع المكتب' : 'Consultancy Signature',
    page: lang === 'ar' ? 'صفحة' : 'Page',
    of: lang === 'ar' ? 'من' : 'of',
    status: lang === 'ar' ? 'الحالة' : 'Status',
    noAmendments: lang === 'ar' ? 'لا توجد تعديلات' : 'No amendments',
  };

  // ===== HEADER =====
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName, margin, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (settings?.taxNumber) {
    doc.text(`${lang === 'ar' ? 'الرقم الضريبي' : 'Tax No.'}: ${settings.taxNumber}`, margin, 25);
  }
  if (settings?.address) {
    doc.text(settings.address, pageWidth - margin, 15, { align: 'right' });
  }

  yPos = 45;

  // ===== CONTRACT TITLE =====
  doc.setTextColor(...TEAL);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(t.contract, pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text(contract.title || '', pageWidth / 2, yPos, { align: 'center' });

  yPos += 6;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${t.contractNumber}: ${contract.number}`, pageWidth / 2, yPos, { align: 'center' });

  // Status
  yPos += 5;
  const statusText = STATUS_LABELS[contract.status]?.[lang] || contract.status;
  doc.text(`${t.status}: ${statusText}`, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // ===== PARTIES SECTION =====
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 45, 'F');

  doc.setTextColor(...TEAL);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t.parties, margin + 5, yPos + 8);

  // First Party (Client)
  yPos += 15;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t.firstParty, margin + 5, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(contract.client.name, margin + 5, yPos);
  if (contract.client.company) {
    yPos += 4;
    doc.setFontSize(9);
    doc.text(contract.client.company.substring(0, 50), margin + 5, yPos);
  }

  // Second Party (Consultancy) - right side
  let rightY = yPos - 9;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t.secondParty, pageWidth - margin - 5, rightY, { align: 'right' });
  rightY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(orgName, pageWidth - margin - 5, rightY, { align: 'right' });
  rightY += 4;
  doc.setFontSize(9);
  if (settings?.address) {
    doc.text(settings.address.substring(0, 50), pageWidth - margin - 5, rightY, { align: 'right' });
  }

  yPos = Math.max(yPos, rightY) + 15;

  // ===== CONTRACT DETAILS =====
  doc.setTextColor(...TEAL);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t.projectDetails, margin, yPos);

  yPos += 8;

  const contractCurrency = settings?.currency || 'AED';
  const detailsData: string[][] = [];
  detailsData.push([t.contractType, CONTRACT_TYPE_LABELS[contract.type]?.[lang] || contract.type]);
  detailsData.push([t.contractValue, formatCurrency(Number(contract.value), contractCurrency)]);

  if (contract.project) {
    detailsData.push([t.projectName, lang === 'ar' ? contract.project.name : (contract.project.nameEn || contract.project.name)]);
  }
  if (contract.project?.location) {
    detailsData.push([t.projectLocation, contract.project.location]);
  }
  detailsData.push([t.startDate, formatDate(contract.startDate)]);
  detailsData.push([t.endDate, formatDate(contract.endDate)]);

  autoTable(doc, {
    startY: yPos,
    body: detailsData.map(row => row.map(cell => preprocessArabicText(cell))),
    theme: 'plain',
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { cellWidth: 'auto', textColor: [30, 41, 59] },
    },
    styles: {
      font: 'Cairo',
      fontSize: 10,
      cellPadding: 3,
    },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable?.finalY || yPos + 40;
  yPos += 10;

  // ===== AMENDMENTS SECTION =====
  if (contract.amendments.length > 0) {
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }

    doc.setTextColor(...TEAL);
    doc.setFontSize(12);
    doc.setFont('Cairo', 'bold');
    doc.text(t.amendments, margin, yPos);

    yPos += 5;

    const amendmentHeaders = lang === 'ar'
      ? [['رقم', 'الوصف', 'التاريخ', 'الحالة']]
      : [['#', 'Description', 'Date', 'Status']];

    const amendmentData = contract.amendments.map((am, idx) => [
      (idx + 1).toString(),
      (am.description || '').substring(0, 80),
      formatDate(am.date),
      STATUS_LABELS[am.status]?.[lang] || am.status,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: amendmentHeaders.map(row => row.map(cell => preprocessArabicText(cell))),
      body: amendmentData.map(row => row.map(cell => preprocessArabicText(cell))),
      theme: 'striped',
      styles: {
        font: 'Cairo',
      },
      headStyles: {
        fillColor: TEAL,
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: margin, right: margin },
    });


    yPos = doc.lastAutoTable?.finalY || yPos + 30;
    yPos += 10;
  }

  // ===== SIGNATURES SECTION =====
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = margin;
  }

  doc.setTextColor(...TEAL);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(t.signatures, margin, yPos);

  yPos += 15;

  const sigWidth = 70;
  const sigHeight = 35;
  const leftSigX = margin;
  const rightSigX = pageWidth - margin - sigWidth;

  // Client signature box
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.rect(leftSigX, yPos, sigWidth, sigHeight);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t.clientSignature, leftSigX + sigWidth / 2, yPos + 5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(contract.signedByName || contract.client.name, leftSigX + sigWidth / 2, yPos + sigHeight - 8, { align: 'center' });

  // Consultancy signature box
  doc.setDrawColor(203, 213, 225);
  doc.rect(rightSigX, yPos, sigWidth, sigHeight);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(t.contractorSignature, rightSigX + sigWidth / 2, yPos + 5, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(lang === 'ar' ? 'مدير المكتب' : 'Office Manager', rightSigX + sigWidth / 2, yPos + sigHeight - 8, { align: 'center' });

  // ===== FOOTER =====
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${t.page} ${i} ${t.of} ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(orgName, margin, pageHeight - 10);
  }

  return Buffer.from(doc.output('arraybuffer'));
}
