// Server-side Official Ratios Sheet PDF generator (جدول النسب الرسمية)
// Mirrors the financing-program progress-payment form: per-work-item approved
// percentages, executed amounts against the contract value, maintenance
// deduction, and three-party signature blocks.

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

const NAVY = [19, 51, 113] as [number, number, number]; // brand-navy-600
const SLATE = [100, 116, 139] as [number, number, number];
const INK = [30, 41, 59] as [number, number, number];

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value: number): string {
  return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export async function generateRatioSheetPDFBuffer(
  projectId: string,
  lang: 'ar' | 'en' = 'ar'
): Promise<Buffer> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      number: true,
      name: true,
      nameEn: true,
      budget: true,
      organizationId: true,
      client: { select: { name: true } },
      contractor: { select: { companyName: true, name: true, nameEn: true } },
    },
  });
  if (!project) throw new Error('Project not found');

  const [sheet, settings] = await Promise.all([
    db.ratioSheet.findFirst({ where: { projectId, deletedAt: null } }),
    db.companySettings.findFirst({ where: { organizationId: project.organizationId } }),
  ]);

  const items = await db.projectRatio.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { order: 'asc' },
  });

  const isAr = lang === 'ar';
  const orgName = isAr
    ? (settings?.name || 'BluePrint')
    : (settings?.nameEn || 'BluePrint Engineering');
  const contractValue = Number(sheet?.contractValue || 0) || Number(project.budget) || 0;
  const maintenancePct = Number(sheet?.maintenancePct ?? 10);
  const clientName = project.client?.name || '-';
  const contractorName = (isAr
    ? (project.contractor?.companyName || project.contractor?.name)
    : (project.contractor?.nameEn || project.contractor?.companyName)) || '-';

  // Provision defaults defensively if PDF requested before first GET
  const sheetItems = items.length > 0 ? items : [];

  const { jsPDF, autoTable } = await getJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await setupArabicPdf(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ===== HEADER =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('Cairo', 'bold');
  doc.text(orgName, pageWidth / 2, 12, { align: 'center' });

  doc.setFontSize(11);
  doc.text(
    preprocessArabicText(isAr ? 'جدول النسب الرسمية المعتمدة' : 'Official Approved Ratios Sheet'),
    pageWidth / 2,
    20,
    { align: 'center' }
  );

  doc.setFontSize(8);
  doc.setFont('Cairo', 'normal');
  doc.setTextColor(200, 210, 235);
  doc.text(
    preprocessArabicText(
      isAr
        ? `برنامج/جهة التمويل: ${sheet?.programName || '-'}    رقم الملف: ${sheet?.fileNumber || '-'}    البنك الممول: ${sheet?.bankName || '-'}`
        : `Program: ${sheet?.programName || '-'}    File No.: ${sheet?.fileNumber || '-'}    Financing Bank: ${sheet?.bankName || '-'}`
    ),
    pageWidth / 2,
    26,
    { align: 'center' }
  );

  // ===== PROJECT INFO BOX =====
  let y = 38;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.setFont('Cairo', 'normal');

  const infoRows: [string, string][] = [
    [isAr ? 'المالك' : 'Owner', clientName],
    [isAr ? 'المشروع' : 'Project', `${isAr ? project.name : project.nameEn || project.name} #${project.number}`],
    [isAr ? 'المقاول' : 'Contractor', contractorName],
    [isAr ? 'قيمة العقد' : 'Contract Value', `${formatCurrency(contractValue)} AED`],
  ];

  const colW = (pageWidth - margin * 2) / 2;
  infoRows.forEach((row, idx) => {
    const col = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const x = margin + colW * (1 - col);
    const yy = y + 7 + rowIdx * 7;
    doc.setTextColor(...SLATE);
    doc.text(`${preprocessArabicText(row[0])}:`, x - 4, yy, { align: 'right' });
    doc.setTextColor(...INK);
    doc.setFont('Cairo', 'bold');
    doc.text(preprocessArabicText(row[1]), x - 30, yy, { align: 'right' });
    doc.setFont('Cairo', 'normal');
  });

  y += 28;

  // ===== MAIN RATIOS TABLE =====
  // Column order follows the app-wide invoice PDF convention (# on the left).
  const tableHeaders = isAr
    ? [['#', 'البند', 'النسبة الرسمية', 'نسبة التنفيذ', 'قيمة النسبة', 'قيمة المنفذ', 'ملاحظات']]
    : [['#', 'Work Item', 'Official %', 'Executed %', 'Official Value', 'Executed Value', 'Notes']];

  const tableData = sheetItems.map((it, idx) => {
    const officialPct = Number(it.officialPct);
    const executedPct = Number(it.executedPct);
    return [
      String(idx + 1),
      preprocessArabicText(isAr ? it.itemName : (it.itemNameEn || it.itemName)),
      pct(officialPct),
      pct(executedPct),
      formatCurrency((contractValue * officialPct) / 100),
      formatCurrency((contractValue * executedPct) / 100),
      preprocessArabicText(it.notes || '-'),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHeaders.map((row) => row.map((cell) => preprocessArabicText(cell))),
    body: tableData,
    margin: { left: margin, right: margin },
    theme: 'striped',
    styles: { font: 'Cairo', fontSize: 8 },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 3,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.6,
      textColor: INK,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'right' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 27, halign: 'right' },
      5: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'right' },
    },
  });

  // ===== TOTALS =====
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 60;
  let totalsY = finalY + 8;

  const totalExecutedValue = sheetItems.reduce(
    (s, it) => s + (contractValue * Number(it.executedPct)) / 100,
    0
  );
  const maintenanceAmount = (totalExecutedValue * maintenancePct) / 100;
  const netDue = totalExecutedValue - maintenanceAmount;
  const totalOfficialPct = sheetItems.reduce((s, it) => s + Number(it.officialPct), 0);

  const totalsBoxWidth = 100;
  const totalsBoxX = pageWidth - margin - totalsBoxWidth;
  const totalsBoxH = isAr ? 30 : 26;
  doc.setFillColor(238, 242, 250);
  doc.roundedRect(totalsBoxX, totalsY - 4, totalsBoxWidth, totalsBoxH, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('Cairo', 'normal');
  doc.setTextColor(...SLATE);

  const labelX = totalsBoxX + totalsBoxWidth - 32;
  doc.text(
    preprocessArabicText(isAr ? 'إجمالي النسب الرسمية' : 'Total Official %'),
    labelX,
    totalsY + 1,
    { align: 'right' }
  );
  doc.setTextColor(...INK);
  doc.setFont('Cairo', 'bold');
  doc.text(pct(totalOfficialPct), pageWidth - margin - 4, totalsY + 1, { align: 'right' });

  doc.setFont('Cairo', 'normal');
  doc.setTextColor(...SLATE);
  totalsY += 7;
  doc.text(
    preprocessArabicText(isAr ? 'إجمالي قيمة المنفذ' : 'Total Executed Value'),
    labelX,
    totalsY + 1,
    { align: 'right' }
  );
  doc.setTextColor(...INK);
  doc.setFont('Cairo', 'bold');
  doc.text(`${formatCurrency(totalExecutedValue)} AED`, pageWidth - margin - 4, totalsY + 1, { align: 'right' });

  doc.setFont('Cairo', 'normal');
  doc.setTextColor(...SLATE);
  totalsY += 7;
  doc.text(
    preprocessArabicText(isAr ? `استقطاع الصيانة (${maintenancePct}%)` : `Maintenance Deduction (${maintenancePct}%)`),
    labelX,
    totalsY + 1,
    { align: 'right' }
  );
  doc.setTextColor(234, 88, 12);
  doc.setFont('Cairo', 'bold');
  doc.text(`${formatCurrency(maintenanceAmount)} AED`, pageWidth - margin - 4, totalsY + 1, { align: 'right' });

  doc.setFont('Cairo', 'normal');
  doc.setTextColor(...SLATE);
  totalsY += 7;
  doc.text(
    preprocessArabicText(isAr ? 'الصافي المستحق' : 'Net Due'),
    labelX,
    totalsY + 1,
    { align: 'right' }
  );
  doc.setTextColor(...NAVY);
  doc.setFontSize(10.5);
  doc.setFont('Cairo', 'bold');
  doc.text(`${formatCurrency(netDue)} AED`, pageWidth - margin - 4, totalsY + 1, { align: 'right' });

  if (sheet?.notes) {
    totalsY += 10;
    doc.setFontSize(8);
    doc.setFont('Cairo', 'normal');
    doc.setTextColor(...SLATE);
    doc.text(
      preprocessArabicText(`${isAr ? 'ملاحظات' : 'Notes'}: ${sheet.notes}`),
      margin,
      totalsY,
      { align: 'right' }
    );
  }

  // ===== SIGNATURE BLOCKS (three-party) =====
  const signY = pageHeight - 48;
  const signW = (pageWidth - margin * 2 - 12) / 3;

  const parties: [string, string][] = [
    [isAr ? 'توقيع المالك' : 'Owner Signature', clientName],
    [isAr ? 'توقيع المكتب الاستشاري' : 'Consultant Signature', orgName],
    [isAr ? 'توقيع المقاول' : 'Contractor Signature', contractorName],
  ];

  parties.forEach((party, idx) => {
    const x = pageWidth - margin - signW - idx * (signW + 6);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, signY, signW, 26, 2, 2);
    doc.setFontSize(8.5);
    doc.setTextColor(...SLATE);
    doc.setFont('Cairo', 'normal');
    doc.text(preprocessArabicText(party[0]), x + signW / 2, signY + 6, { align: 'center' });
    doc.setTextColor(...INK);
    doc.setFont('Cairo', 'bold');
    doc.text(preprocessArabicText(party[1].slice(0, 30)), x + signW / 2, signY + 12, { align: 'center' });
    doc.setDrawColor(148, 163, 184);
    doc.line(x + 8, signY + 21, x + signW - 8, signY + 21);
  });

  // ===== FOOTER =====
  doc.setFontSize(7.5);
  doc.setFont('Cairo', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    preprocessArabicText(
      isAr
        ? 'النسب الرسمية معتمدة باتفاق الأطراف — استقطاع الصيانة يُصرف بعد انتهاء فترة الصيانة'
        : 'Official ratios approved by the parties — maintenance deduction released after the maintenance period'
    ),
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Ensure default items exist note (defensive: empty sheet)
  if (sheetItems.length === 0) {
    doc.addPage('a4', 'portrait');
    doc.setTextColor(...SLATE);
    doc.setFontSize(9);
    doc.text(
      preprocessArabicText('لا توجد بنود مسجلة بعد — افتح جدول النسب الرسمية من ملف المشروع لتوليد البنود الافتراضية.'),
      pageWidth / 2,
      40,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}
