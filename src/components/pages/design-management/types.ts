// ===== Types =====
export interface DesignPhaseItem {
  id: string;
  projectId: string;
  phase: string;
  phaseNameAr: string;
  phaseNameEn: string;
  status: string;
  designerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  revisionCount: number;
  notes: string;
  clientApproval: boolean;
  createdAt: string;
  drawings: { id: string; status: string; clashDetected: boolean }[];
  project: { id: string; name: string; nameEn: string; number: string } | null;
}

export interface DesignDrawingItem {
  id: string;
  designPhaseId: string;
  title: string;
  drawingNumber: string;
  discipline: string;
  version: number;
  filePath: string;
  fileSize: number;
  status: string;
  reviewedBy: string | null;
  reviewNotes: string;
  reviewedAt: string | null;
  clashDetected: boolean;
  clashNotes: string;
  uploadedById: string | null;
  createdAt: string;
  designPhase: { id: string; phase: string; phaseNameAr: string; phaseNameEn: string };
  revisions: DesignRevisionItem[];
}

export interface DesignRevisionItem {
  id: string;
  drawingId: string;
  version: number;
  filePath: string;
  changeNotes: string;
  uploadedById: string | null;
  createdAt: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  nameEn: string;
  number: string;
}

// ===== Phase Config =====
// التسميات موحدة مع DesignPipeline في ملف المشروع (project-detail/constants.ts)
// على مصطلحات مكاتب الاستشارات الهندسية في الإمارات
export const PHASE_ORDER = ["CONCEPT", "SCHEMATIC", "DEVELOPMENT", "CONSTRUCTION_DOCS", "AS_BUILT"];

export const PHASE_CONFIG: Record<string, { labelAr: string; labelEn: string; icon: string }> = {
  CONCEPT: { labelAr: "المخطط المبدئي", labelEn: "Concept", icon: "💡" },
  SCHEMATIC: { labelAr: "المخطط التخطيطي", labelEn: "Schematic", icon: "📐" },
  DEVELOPMENT: { labelAr: "التصميم التفصيلي", labelEn: "Design Development", icon: "🏗️" },
  CONSTRUCTION_DOCS: { labelAr: "المخططات التنفيذية", labelEn: "Construction Docs", icon: "📋" },
  AS_BUILT: { labelAr: "كما نُفذ", labelEn: "As-Built", icon: "✅" },
};

export const STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string; dotColor: string }> = {
  NOT_STARTED: { labelAr: "لم يبدأ", labelEn: "Not Started", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", dotColor: "bg-slate-400" },
  IN_PROGRESS: { labelAr: "قيد التنفيذ", labelEn: "In Progress", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", dotColor: "bg-amber-500" },
  UNDER_REVIEW: { labelAr: "قيد المراجعة", labelEn: "Under Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", dotColor: "bg-blue-500" },
  APPROVED: { labelAr: "معتمد", labelEn: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", dotColor: "bg-emerald-500" },
  REVISION: { labelAr: "تعديل مطلوب", labelEn: "Revision", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", dotColor: "bg-red-500" },
};

export const DRAWING_STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string }> = {
  DRAFT: { labelAr: "مسودة", labelEn: "Draft", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  UNDER_REVIEW: { labelAr: "قيد المراجعة", labelEn: "Under Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  APPROVED: { labelAr: "معتمد", labelEn: "Approved", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
  REJECTED: { labelAr: "مرفوض", labelEn: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
  SUPERSEDED: { labelAr: "مُستبدل", labelEn: "Superseded", color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500" },
};

export const DISCIPLINE_CONFIG: Record<string, { labelAr: string; labelEn: string }> = {
  ARCHITECTURAL: { labelAr: "معماري", labelEn: "Architectural" },
  STRUCTURAL: { labelAr: "إنشائي", labelEn: "Structural" },
  ELECTRICAL: { labelAr: "كهربائي", labelEn: "Electrical" },
  PLUMBING: { labelAr: "سباكة", labelEn: "Plumbing" },
  HVAC: { labelAr: "تكييف", labelEn: "HVAC" },
  FIRE: { labelAr: "حريق", labelEn: "Fire Protection" },
};

export const REVIEW_CHECKLIST = [
  { id: "dimensions", labelAr: "الأبعاد صحيحة", labelEn: "Dimensions are correct" },
  { id: "setbacks", labelAr: "الارتدادات مطابقة", labelEn: "Setbacks are compliant" },
  { id: "floors", labelAr: "عدد الأدوار مطابق", labelEn: "Floor count matches" },
  { id: "areas", labelAr: "المساحات صحيحة", labelEn: "Areas are correct" },
  { id: "civil_defense", labelAr: "اشتراطات الدفاع المدني", labelEn: "Civil defense requirements" },
  { id: "building_code", labelAr: "كود البناء", labelEn: "Building code compliance" },
];

// ===== Helpers =====
export function formatDate(dateStr: string | null, ar: boolean): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(ar ? "ar-AE" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
