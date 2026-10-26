/**
 * Default work items for the Official Ratios Sheet (جدول النسب الرسمية).
 *
 * Mirrors the financing-program progress-payment form used for villas
 * (e.g. Sheikh Zayed Housing Programme style sheets): each work item carries
 * its approved official percentage. The percentages below are a standard
 * villa-construction breakdown summing to 100% — they are fully editable
 * per project so the office can match the exact program table.
 */

export interface RatioItemDefault {
  itemName: string;
  itemNameEn: string;
  officialPct: number;
}

export const DEFAULT_RATIO_ITEMS: RatioItemDefault[] = [
  { itemName: "أعمال الحفر والأساسات", itemNameEn: "Excavation & Foundations", officialPct: 8 },
  { itemName: "الهيكل الخرساني", itemNameEn: "Concrete Structure", officialPct: 15 },
  { itemName: "أعمال البناء", itemNameEn: "Masonry Works", officialPct: 10 },
  { itemName: "أعمال المحارة", itemNameEn: "Plastering Works", officialPct: 7 },
  { itemName: "أعمال العزل المائي والحراري", itemNameEn: "Waterproofing & Insulation", officialPct: 4 },
  { itemName: "أعمال الأرضيات والبلاط", itemNameEn: "Flooring & Tiling", officialPct: 8 },
  { itemName: "أعمال النجارة والأبواب", itemNameEn: "Carpentry & Doors", officialPct: 6 },
  { itemName: "أعمال الألمنيوم والزجاج", itemNameEn: "Aluminum & Glass", officialPct: 5 },
  { itemName: "أعمال الكهرباء", itemNameEn: "Electrical Works", officialPct: 7 },
  { itemName: "أعمال التكييف والتهوية", itemNameEn: "HVAC Works", officialPct: 5 },
  { itemName: "أعمال السباكة والصحي", itemNameEn: "Plumbing & Sanitary", officialPct: 6 },
  { itemName: "أعمال الدهانات", itemNameEn: "Painting Works", officialPct: 6 },
  { itemName: "الواجهات والتشطيبات الخارجية", itemNameEn: "External Facades & Finishes", officialPct: 5 },
  { itemName: "تنسيق الموقع والأسوار", itemNameEn: "Landscaping & Fences", officialPct: 4 },
  { itemName: "أعمال التنظيف والاستلام", itemNameEn: "Cleaning & Handover", officialPct: 2 },
  { itemName: "أعمال متنوعة (احتياطي)", itemNameEn: "Miscellaneous (Reserve)", officialPct: 2 },
];

/** Validation helpers shared by the ratio-sheet API routes */
export const MAX_RATIO_ITEMS = 60;

export function isValidPct(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}
