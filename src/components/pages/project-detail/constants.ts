import {
  Eye,
  Building2,
  HardHat,
  Zap,
  Landmark,
  Calculator,
  ShieldAlert,
  CheckSquare,
  FileSignature,
  FileText,
  Wallet,
  Receipt,
  CreditCard,
  PiggyBank,
  FileSpreadsheet,
  Gavel,
  ClipboardCheck,
  Activity,
  Send,
  BarChart3,
  Award,
  PenTool,
  AlertTriangle,
  SearchCheck,
  GitBranch,
  Droplets,
  FileCheck,
  Scale,
} from "lucide-react";
import type { DesignDiscipline } from "./types";

// ===== STATUS CONSTANTS =====
export const STATUS_LABELS: Record<string, Record<string, string>> = {
  ar: {
    NOT_STARTED: "لم يبدأ", IN_PROGRESS: "قيد التنفيذ",
    SUBMITTED: "مقدم للمراجعة", APPROVED: "معتمد", REJECTED: "مرفوض",
    PENDING: "معلق", COMPLETED: "مكتمل", DRAFT: "مسودة",
    ACTIVE: "نشط", DELAYED: "متأخر",
    ON_HOLD: "معلق", CANCELLED: "ملغى",
  },
  en: {
    NOT_STARTED: "Not Started", IN_PROGRESS: "In Progress",
    SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected",
    PENDING: "Pending", COMPLETED: "Completed", DRAFT: "Draft",
    ACTIVE: "Active", DELAYED: "Delayed",
    ON_HOLD: "On Hold", CANCELLED: "Cancelled",
  },
};

export const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200",
  COMPLETED: "bg-brand-navy-100 text-brand-navy-700 dark:bg-brand-navy-900/30 dark:text-brand-navy-400 border border-brand-navy-200",
  DELAYED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200",
};

export const DESIGN_STEP_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SUBMITTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

// ===== TAB CONFIGURATION =====
// الترتيب يتبع سير عمل المكتب الفعلي:
// نظرة عامة → التصميم (معماري/إنشائي/ميب) → البلدية → المقاييس والمواصفات (التندر)
// → تعيين المقاول → الإشراف → المالية → المستندات — ثم الأدوات المساندة (مهام/سير عمل)
export const mainTabs = [
  { id: "overview", icon: Eye, labelAr: "نظرة عامة", labelEn: "Overview" },
  { id: "design", icon: PenTool, labelAr: "مرحلة التصميم", labelEn: "Design Stage" },
  { id: "municipality", icon: Landmark, labelAr: "البلدية", labelEn: "Municipality" },
  { id: "boq", icon: Calculator, labelAr: "مقاييس ومواصفات", labelEn: "BOQ & Specs" },
  { id: "contractor", icon: HardHat, labelAr: "تعيين مقاول", labelEn: "Contractor Assignment" },
  { id: "supervision", icon: ClipboardCheck, labelAr: "الإشراف", labelEn: "Supervision" },
  { id: "financial", icon: Wallet, labelAr: "المالية", labelEn: "Financial" },
  { id: "documents", icon: FileText, labelAr: "المستندات", labelEn: "Documents" },
  { id: "tasks", icon: CheckSquare, labelAr: "المهام", labelEn: "Tasks" },
  { id: "workflow", icon: GitBranch, labelAr: "سير العمل", labelEn: "Workflow" },
];

export const designSubTabs = [
  { id: "ARCHITECTURAL", icon: Building2, labelAr: "المعماري", labelEn: "Architectural" },
  { id: "STRUCTURAL", icon: HardHat, labelAr: "الإنشائي", labelEn: "Structural" },
  { id: "MEP", icon: Zap, labelAr: "الكهربائي والميكانيك", labelEn: "MEP" },
  { id: "civil-defense", icon: ShieldAlert, labelAr: "الدفاع المدني", labelEn: "Civil Defense" },
];

export const municipalitySubTabs = [
  { id: "license", icon: FileSignature, labelAr: "الرخصة", labelEn: "License" },
  { id: "correspondence", icon: Landmark, labelAr: "المراسلات البلدية", labelEn: "Correspondence" },
  { id: "approved-drawings", icon: FileCheck, labelAr: "المخططات المعتمدة", labelEn: "Approved Drawings" },
];

export const boqSubTabs = [
  { id: "boq", icon: Calculator, labelAr: "جدول الكميات", labelEn: "BOQ" },
  { id: "specs", icon: FileText, labelAr: "المواصفات الفنية", labelEn: "Specifications" },
];

export const contractorSubTabs = [
  { id: "rfq", icon: Send, labelAr: "إرسال طلب عرض", labelEn: "Send RFQ" },
  { id: "bids", icon: Gavel, labelAr: "عروض الأسعار", labelEn: "Price Bids" },
  { id: "comparison", icon: BarChart3, labelAr: "مقارنة ذكية", labelEn: "Smart Compare" },
  { id: "award", icon: Award, labelAr: "الترسية", labelEn: "Award" },
];

export const supervisionSubTabs = [
  { id: "checklists", icon: ClipboardCheck, labelAr: "زيارات الإشراف", labelEn: "Supervision Visits" },
  { id: "violations", icon: AlertTriangle, labelAr: "المخالفات", labelEn: "Violations" },
  { id: "inspections", icon: SearchCheck, labelAr: "فحص المباني", labelEn: "Building Inspections" },
  { id: "completion", icon: Award, labelAr: "شهادة الإنجاز", labelEn: "Completion Certificate" },
];

export const financialSubTabs = [
  { id: "invoices", icon: Receipt, labelAr: "الفواتير", labelEn: "Invoices" },
  { id: "payments", icon: CreditCard, labelAr: "المدفوعات", labelEn: "Payments" },
  { id: "budgets", icon: PiggyBank, labelAr: "الميزانية", labelEn: "Budget" },
  { id: "budget-comparison", icon: Scale, labelAr: "الميزانية مقابل الفعلي", labelEn: "Budget vs Actual" },
  { id: "proposals", icon: FileSpreadsheet, labelAr: "العروض", labelEn: "Proposals" },
];

// ===== DESIGN PIPELINE CONSTANTS =====
export const DESIGN_PIPELINE_STAGES = [
  { key: "CONCEPT", labelAr: "مبدئي", labelEn: "Concept" },
  { key: "SCHEMATIC", labelAr: "تخطيطي", labelEn: "Schematic" },
  { key: "DEVELOPMENT", labelAr: "تطوير", labelEn: "Development" },
  { key: "CONSTRUCTION_DOCS", labelAr: "مخططات تنفيذية", labelEn: "Construction Docs" },
  { key: "AS_BUILT", labelAr: "أس-بيلت", labelEn: "As-Built" },
];

export const DESIGN_DISCIPLINES: DesignDiscipline[] = [
  {
    id: "ARCHITECTURAL", nameAr: "المعماري", nameEn: "Architectural", icon: Building2, color: "#133371", supervisor: "",
    steps: [
      { id: "arch-1", nameAr: "التخطيط المساحي", nameEn: "Space Planning", assignee: "", status: "NOT_STARTED", date: null },
      { id: "arch-2", nameAr: "التصميم المبدئي", nameEn: "Preliminary Design", assignee: "", status: "NOT_STARTED", date: null },
      { id: "arch-3", nameAr: "تطوير التصميم", nameEn: "Design Development", assignee: "", status: "NOT_STARTED", date: null },
      { id: "arch-4", nameAr: "المخططات النهائية", nameEn: "Final Drawings", assignee: "", status: "NOT_STARTED", date: null },
      { id: "arch-5", nameAr: "موافقة العميل", nameEn: "Client Approval", assignee: "", status: "NOT_STARTED", date: null },
      { id: "arch-6", nameAr: "تقديم البلدية", nameEn: "Municipality Submission", assignee: "", status: "NOT_STARTED", date: null },
    ],
  },
  {
    id: "STRUCTURAL", nameAr: "الإنشائي", nameEn: "Structural", icon: HardHat, color: "#f59e0b", supervisor: "",
    steps: [
      { id: "str-1", nameAr: "التحليل الإنشائي", nameEn: "Structural Analysis", assignee: "", status: "NOT_STARTED", date: null },
      { id: "str-2", nameAr: "تصميم الأساسات", nameEn: "Foundation Design", assignee: "", status: "NOT_STARTED", date: null },
      { id: "str-3", nameAr: "تصميم الأعمدة والعتلات", nameEn: "Column/Beam Design", assignee: "", status: "NOT_STARTED", date: null },
      { id: "str-4", nameAr: "المخططات الإنشائية النهائية", nameEn: "Final Structural Drawings", assignee: "", status: "NOT_STARTED", date: null },
      { id: "str-5", nameAr: "المراجعة والاعتماد", nameEn: "Review & Approval", assignee: "", status: "NOT_STARTED", date: null },
    ],
  },
  {
    id: "mep_electrical", nameAr: "MEP الكهرباء", nameEn: "MEP Electrical", icon: Zap, color: "#3b82f6", supervisor: "",
    steps: [
      { id: "el-1", nameAr: "تخطيط الكهرباء", nameEn: "Electrical Layout", assignee: "", status: "NOT_STARTED", date: null },
      { id: "el-2", nameAr: "توزيع الطاقة", nameEn: "Power Distribution", assignee: "", status: "NOT_STARTED", date: null },
      { id: "el-3", nameAr: "تصميم الإضاءة", nameEn: "Lighting Design", assignee: "", status: "NOT_STARTED", date: null },
      { id: "el-4", nameAr: "المخططات النهائية", nameEn: "Final Drawings", assignee: "", status: "NOT_STARTED", date: null },
      { id: "el-5", nameAr: "الاعتماد", nameEn: "Approval", assignee: "", status: "NOT_STARTED", date: null },
    ],
  },
  {
    id: "mep_plumbing", nameAr: "MEP السباكة", nameEn: "MEP Plumbing", icon: Droplets, color: "#06b6d4", supervisor: "",
    steps: [
      { id: "pl-1", nameAr: "تخطيط السباكة", nameEn: "Plumbing Layout", assignee: "", status: "NOT_STARTED", date: null },
      { id: "pl-2", nameAr: "إمداد المياه", nameEn: "Water Supply", assignee: "", status: "NOT_STARTED", date: null },
      { id: "pl-3", nameAr: "تصميم الصرف", nameEn: "Drainage Design", assignee: "", status: "NOT_STARTED", date: null },
      { id: "pl-4", nameAr: "المخططات النهائية", nameEn: "Final Drawings", assignee: "", status: "NOT_STARTED", date: null },
      { id: "pl-5", nameAr: "الاعتماد", nameEn: "Approval", assignee: "", status: "NOT_STARTED", date: null },
    ],
  },
  {
    id: "mep_hvac", nameAr: "MEP التكييف", nameEn: "MEP HVAC", icon: Activity, color: "#8b5cf6", supervisor: "",
    steps: [
      { id: "hv-1", nameAr: "حساب الأحمال الحرارية", nameEn: "HVAC Load Calculation", assignee: "", status: "NOT_STARTED", date: null },
      { id: "hv-2", nameAr: "تصميم القنوات", nameEn: "Duct Design", assignee: "", status: "NOT_STARTED", date: null },
      { id: "hv-3", nameAr: "اختيار المعدات", nameEn: "Equipment Selection", assignee: "", status: "NOT_STARTED", date: null },
      { id: "hv-4", nameAr: "المخططات النهائية", nameEn: "Final Drawings", assignee: "", status: "NOT_STARTED", date: null },
      { id: "hv-5", nameAr: "الاعتماد", nameEn: "Approval", assignee: "", status: "NOT_STARTED", date: null },
    ],
  },
  {
    id: "civil_defense", nameAr: "الدفاع المدني", nameEn: "Civil Defense", icon: ShieldAlert, color: "#ef4444", supervisor: "",
    steps: [
      { id: "cd-1", nameAr: "خطة السلامة من الحرائق", nameEn: "Fire Safety Plan", assignee: "", status: "NOT_STARTED", date: null },
      { id: "cd-2", nameAr: "طرق الإخلاء", nameEn: "Evacuation Routes", assignee: "", status: "NOT_STARTED", date: null },
      { id: "cd-3", nameAr: "نظام إنذار الحريق", nameEn: "Fire Alarm System", assignee: "", status: "NOT_STARTED", date: null },
      { id: "cd-4", nameAr: "التقديم النهائي", nameEn: "Final Submission", assignee: "", status: "NOT_STARTED", date: null },
      { id: "cd-5", nameAr: "الاعتماد", nameEn: "Approval", assignee: "", status: "NOT_STARTED", date: null },
    ],
  },
];

export const APPROVAL_CHAIN = [
  { key: "engineer", labelAr: "المهندس", labelEn: "Engineer" },
  { key: "lead_engineer", labelAr: "المهندس الأول", labelEn: "Lead Engineer" },
  { key: "dept_head", labelAr: "رئيس القسم", labelEn: "Department Head" },
  { key: "manager", labelAr: "المدير", labelEn: "Manager" },
];

export const PIPELINE_STAGES = [
  { key: "design", labelAr: "التصميم", labelEn: "Design", icon: PenTool },
  { key: "municipality", labelAr: "البلدية", labelEn: "Municipality", icon: Landmark },
  { key: "boq", labelAr: "كميات", labelEn: "BOQ", icon: Calculator },
  { key: "contractor", labelAr: "المقاول", labelEn: "Contractor", icon: HardHat },
  { key: "supervision", labelAr: "الإشراف", labelEn: "Supervision", icon: ClipboardCheck },
];


export const MUNICIPALITY_PREREQUISITES = [
  { id: "arch", labelAr: "المخططات المعمارية المعتمدة", labelEn: "Approved Architectural Drawings", dependsOn: "ARCHITECTURAL" },
  { id: "struct", labelAr: "المخططات الإنشائية المعتمدة", labelEn: "Approved Structural Drawings", dependsOn: "STRUCTURAL" },
  { id: "elec", labelAr: "مخططات الكهرباء", labelEn: "Electrical Drawings", dependsOn: "mep_electrical" },
  { id: "plumb", labelAr: "مخططات السباكة", labelEn: "Plumbing Drawings", dependsOn: "mep_plumbing" },
  { id: "hvac", labelAr: "مخططات التكييف", labelEn: "HVAC Drawings", dependsOn: "mep_hvac" },
  { id: "civil_def", labelAr: "خطة الدفاع المدني", labelEn: "Civil Defense Plan", dependsOn: "civil_defense" },
  { id: "survey", labelAr: "مسح الأرض", labelEn: "Land Survey", dependsOn: "EXTERNAL" },
  { id: "soil", labelAr: "تقرير التربة", labelEn: "Soil Report", dependsOn: "EXTERNAL" },
];
