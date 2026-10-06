export type Role =
  | "ADMIN"
  | "MANAGER"
  | "PROJECT_MANAGER"
  | "ENGINEER"
  | "DRAFTSMAN"
  | "ACCOUNTANT"
  | "HR"
  | "SECRETARY"
  | "VIEWER";

export interface NavItem {
  id: string;
  icon: string;
  labelAr: string;
  labelEn: string;
  roles: Role[];
  children?: NavItem[];
  href?: string;
}

export const roleLabelsAr: Record<Role, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "المدير",
  PROJECT_MANAGER: "مدير مشاريع",
  ENGINEER: "مهندس",
  DRAFTSMAN: "مساح",
  ACCOUNTANT: "محاسب",
  HR: "موارد بشرية",
  SECRETARY: "سكرتارية",
  VIEWER: "مشاهد",
};

export const roleLabelsEn: Record<Role, string> = {
  ADMIN: "System Admin",
  MANAGER: "Manager",
  PROJECT_MANAGER: "Project Manager",
  ENGINEER: "Engineer",
  DRAFTSMAN: "Draftsman",
  ACCOUNTANT: "Accountant",
  HR: "HR",
  SECRETARY: "Secretary",
  VIEWER: "Viewer",
};

const allRoles: Role[] = [
  "ADMIN",
  "MANAGER",
  "PROJECT_MANAGER",
  "ENGINEER",
  "DRAFTSMAN",
  "ACCOUNTANT",
  "HR",
  "SECRETARY",
  "VIEWER",
];

const _managementRoles: Role[] = [
  "ADMIN",
  "MANAGER",
  "PROJECT_MANAGER",
];

const _fullRoles: Role[] = ["ADMIN", "MANAGER"];

// ===== NAVIGATION ITEMS (Simplified) =====
// Strategy: fewer top-level items, no unnecessary sub-menus.
// Pages handle their own tabs internally.
// Notifications → bell icon in header | AI Assistant → floating button | Settings → user dropdown
const allNavItems: NavItem[] = [
  // ───── 1. Dashboard ─────
  {
    id: "dashboard",
    icon: "LayoutDashboard",
    labelAr: "لوحة التحكم",
    labelEn: "Dashboard",
    roles: allRoles,
  },

  // ───── Field Portal (بوابة المهندس الميداني والموقع) ─────
  {
    id: "field-portal",
    icon: "HardHat",
    labelAr: "بوابة الموقع الميدانية",
    labelEn: "Field Portal",
    roles: ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  },

  // ───── 2. Clients (صفحة واحدة بتابات داخلية) ─────
  {
    id: "clients",
    icon: "UserPlus",
    labelAr: "العملاء",
    labelEn: "Clients",
    roles: ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ACCOUNTANT", "SECRETARY"],
  },

  // ───── CRM / Leads (العملاء المحتملين) ─────
  {
    id: "crm-leads",
    icon: "Target",
    labelAr: "العملاء المحتملين",
    labelEn: "CRM Leads",
    roles: ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  },

  // ───── 3. Projects (صفحة واحدة بتابات داخلية + إنشاء جواها) ─────
  {
    id: "projects",
    icon: "FolderKanban",
    labelAr: "المشاريع",
    labelEn: "Projects",
    roles: ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER", "DRAFTSMAN", "SECRETARY"],
  },

  // ───── 4. Contractors (صفحة واحدة بتابات: قائمة + إضافة + RFQs) ─────
  {
    id: "contractors",
    icon: "HardHat",
    labelAr: "المقاولون",
    labelEn: "Contractors",
    roles: ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  },

  // ───── 5. Finance (قائمة فرعية - الوحيدة المحتاجة sub-menu) ─────
  {
    id: "finance",
    icon: "Wallet",
    labelAr: "المالية",
    labelEn: "Finance",
    roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
    children: [
      {
        id: "finance-revenue",
        icon: "TrendingUp",
        labelAr: "الإيرادات",
        labelEn: "Revenue",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-expenses",
        icon: "TrendingDown",
        labelAr: "المصروفات",
        labelEn: "Expenses",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-reports",
        icon: "BarChart3",
        labelAr: "التقارير",
        labelEn: "Reports",
        roles: ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-retainage",
        icon: "Shield",
        labelAr: "الاحتجاز",
        labelEn: "Retainage",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-guarantees",
        icon: "Shield",
        labelAr: "خطابات الضمان",
        labelEn: "Guarantees",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-progress-claims",
        icon: "ClipboardCheck",
        labelAr: "مطالبات التقدم",
        labelEn: "Progress Claims",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT", "PROJECT_MANAGER"],
      },
      {
        id: "finance-accounts",
        icon: "FolderTree",
        labelAr: "شجرة الحسابات",
        labelEn: "Chart of Accounts",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-journal-entries",
        icon: "FileSpreadsheet",
        labelAr: "قيود اليومية",
        labelEn: "Journal Entries",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
      {
        id: "finance-accounting-reports",
        icon: "FileText",
        labelAr: "القوائم المالية",
        labelEn: "Financial Statements",
        roles: ["ADMIN", "MANAGER", "ACCOUNTANT"],
      },
    ],
  },

  // ───── 6. Employees (صفحة واحدة بتابات: قائمة + حضور + إجازات + أعباء) ─────
  {
    id: "employees",
    icon: "UsersRound",
    labelAr: "الموظفين",
    labelEn: "Employees",
    roles: ["ADMIN", "MANAGER", "HR"],
  },

  // ───── 7. Help & AI (المساعدة والذكاء الاصطناعي) ─────
  {
    id: "help",
    icon: "Headphones",
    labelAr: "المساعدة",
    labelEn: "Help & AI",
    roles: allRoles,
    children: [
      {
        id: "ai-assistant",
        icon: "Sparkles",
        labelAr: "المساعد الذكي",
        labelEn: "AI Assistant",
        roles: allRoles,
      },
      {
        id: "knowledge",
        icon: "BookMarked",
        labelAr: "قاعدة المعرفة",
        labelEn: "Knowledge Base",
        roles: allRoles,
      },
      {
        id: "calendar",
        icon: "Calendar",
        labelAr: "التقويم",
        labelEn: "Calendar",
        roles: allRoles,
      },
      {
        id: "search",
        icon: "Search",
        labelAr: "البحث",
        labelEn: "Search",
        roles: allRoles,
      },
      {
        id: "api-docs",
        icon: "BookOpen",
        labelAr: "توثيق API",
        labelEn: "API Docs",
        roles: allRoles,
        href: "/docs",
      },
    ],
  },

  // ───── 8. Advanced Features (المميزات المتقدمة) ─────
  {
    id: "features-hub",
    icon: "Sparkles",
    labelAr: "المميزات المتقدمة",
    labelEn: "Advanced Features",
    roles: ["ADMIN", "MANAGER"],
  },

  // ───── 7. System Admin (admin بس) ─────
  {
    id: "admin",
    icon: "Shield",
    labelAr: "إدارة النظام",
    labelEn: "System Admin",
    roles: ["ADMIN"],
  },
];

// ===== ROLE NORMALIZATION =====
/**
 * Normalize client-side role (lowercase from JWT) to UPPERCASE format
 * used by permissions and navigation.
 * Delegates to @/lib/auth/modules/authorization.ts — canonical implementation.
 */
export { normalizeRole } from '@/lib/auth/modules/authorization';
import { normalizeRole } from '@/lib/auth/modules/authorization';

// ===== FILTER NAVIGATION BY ROLE =====
function filterNavItemsByRole(items: NavItem[], role: Role): NavItem[] {
  return items
    .filter((item) => item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavItemsByRole(item.children, role)
        : undefined,
    }))
    .filter((item) => {
      if (!item.children || item.children.length === 0) {
        return true;
      }
      return item.children.length > 0;
    });
}

export function getNavItems(role: string): NavItem[] {
  return filterNavItemsByRole(allNavItems, normalizeRole(role) as Role);
}

// ===== CHECK PERMISSION HELPER =====
export function hasPagePermission(role: string, pageId: string): boolean {
  const items = getNavItems(role);
  return checkItemAccess(items, pageId);
}

function checkItemAccess(items: NavItem[], pageId: string): boolean {
  for (const item of items) {
    if (item.id === pageId) return true;
    if (item.children && checkItemAccess(item.children, pageId)) return true;
  }
  return false;
}

// ===== PUBLIC DASHBOARD ROUTES (Allowed for all logged-in roles) =====
export const PUBLIC_DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/profile",
  "/dashboard/settings",
  "/dashboard/notifications",
  "/dashboard/help",
  "/dashboard/search",
  "/dashboard/calendar",
  "/dashboard/ai-assistant",
  "/dashboard/knowledge",
  "/dashboard/tasks",
  "/dashboard/meetings",
  "/dashboard/team-members",
];

// ===== ROUTE ROLE MATRIX (Server Guard - Restricted Routes) =====
const ROUTE_ROLE_MATRIX: Record<string, Role[]> = {
  "/dashboard/admin": ["ADMIN"],
  "/dashboard/automations": ["ADMIN"],
  "/dashboard/activity-log": ["ADMIN"],
  "/dashboard/features-hub": ["ADMIN", "MANAGER"],
  
  // Clients & CRM
  "/dashboard/clients": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ACCOUNTANT", "SECRETARY"],
  "/dashboard/crm": ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  "/dashboard/crm-leads": ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  "/dashboard/proposals": ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  "/dashboard/bids": ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  "/dashboard/tenders": ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  "/dashboard/project-templates": ["ADMIN", "MANAGER", "PROJECT_MANAGER"],
  
  // Projects & Technical
  "/dashboard/projects": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER", "DRAFTSMAN", "SECRETARY"],
  "/dashboard/contractors": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/gantt": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/contracts": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ACCOUNTANT"],
  "/dashboard/boq": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/change-orders": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/defects": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/design-management": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER", "DRAFTSMAN"],
  "/dashboard/documents": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER", "SECRETARY"],
  "/dashboard/equipment": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/inspections": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/municipality-correspondence": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER", "SECRETARY"],
  "/dashboard/rfi": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/risks": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/site-diary": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/site-visits": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/field-portal": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/submittals": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/supervision": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  "/dashboard/transmittals": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER"],
  
  // Finance & Accounting
  "/dashboard/finance": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/invoices": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/payments": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/recurring-invoices": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/budgets": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ACCOUNTANT"],
  "/dashboard/progress-claims": ["ADMIN", "MANAGER", "ACCOUNTANT", "PROJECT_MANAGER"],
  "/dashboard/guarantee-letters": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/suppliers": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/purchase-orders": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/billing": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/commissions": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/inventory": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  "/dashboard/report-builder": ["ADMIN", "MANAGER", "ACCOUNTANT"],
  
  // HR & Operations
  "/dashboard/employees": ["ADMIN", "MANAGER", "HR"],
  "/dashboard/attendance": ["ADMIN", "MANAGER", "HR"],
  "/dashboard/leave": ["ADMIN", "MANAGER", "HR"],
  "/dashboard/timesheets": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "ENGINEER", "HR"],
  "/dashboard/workload": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "HR"],
  "/dashboard/approvals": ["ADMIN", "MANAGER", "PROJECT_MANAGER", "HR"],
};

export function isRouteAllowedForRole(pathname: string, role: string): boolean {
  // Support comma-separated multi-roles (e.g. from JWT)
  const roles = role.split(",").map((r) => normalizeRole(r.trim()) as Role);
  
  // ADMIN is a wildcard, always allowed
  if (roles.includes("ADMIN")) {
    return true;
  }

  // 1. Check if the path is in the public dashboard allowlist (direct match or prefix)
  const isPublic = PUBLIC_DASHBOARD_ROUTES.some((prefix) => {
    if (prefix === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === prefix || pathname.startsWith(prefix + "/");
  });
  if (isPublic) {
    return true;
  }

  // 2. Find longest prefix match in the ROUTE_ROLE_MATRIX
  let matchedPrefix = "";
  let allowedRoles: Role[] = [];
  
  for (const prefix of Object.keys(ROUTE_ROLE_MATRIX)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (prefix.length > matchedPrefix.length) {
        matchedPrefix = prefix;
        allowedRoles = ROUTE_ROLE_MATRIX[prefix];
      }
    }
  }

  if (matchedPrefix === "") {
    // Fail-Closed default: if no prefix matched and it is not in the public allowlist, block access
    return false;
  }

  // If any of the user's roles are in the allowed list, grant access
  return roles.some((r) => allowedRoles.includes(r));
}

// ===== PROJECT TAB ITEMS =====
export const projectTabItems = [
  { id: "overview", icon: "Eye", labelAr: "نظرة عامة", labelEn: "Overview" },
  { id: "design-stage", icon: "PenTool", labelAr: "مرحلة التصميم", labelEn: "Design Stage" },
  { id: "municipality", icon: "Landmark", labelAr: "البلدية", labelEn: "Municipality" },
  { id: "boq-specs", icon: "Calculator", labelAr: "مقاييس ومواصفات", labelEn: "BOQ & Specs" },
  { id: "contractor-assignment", icon: "HardHat", labelAr: "تعيين مقاول", labelEn: "Contractor Assignment" },
  { id: "supervision", icon: "ClipboardCheck", labelAr: "الإشراف", labelEn: "Supervision" },
  { id: "tasks", icon: "ListTodo", labelAr: "المهام", labelEn: "Tasks" },
  { id: "FINANCIAL", icon: "Wallet", labelAr: "المالية", labelEn: "Financial" },
  { id: "documents", icon: "FileText", labelAr: "المستندات", labelEn: "Documents" },
  { id: "workflow", icon: "GitBranch", labelAr: "سير العمل", labelEn: "Workflow" },
];

// Design Stage Sub-tabs
export const designSubTabs = [
  { id: "ARCHITECTURAL", icon: "Building2", labelAr: "المعماري", labelEn: "Architectural" },
  { id: "STRUCTURAL", icon: "HardHat", labelAr: "الإنشائي", labelEn: "Structural" },
  { id: "mep-electrical", icon: "Zap", labelAr: "الكهرباء", labelEn: "Electrical" },
  { id: "mep-plumbing", icon: "Droplets", labelAr: "السباكة", labelEn: "Plumbing" },
  { id: "mep-hvac", icon: "Wind", labelAr: "التكييف", labelEn: "HVAC" },
  { id: "civil-defense", icon: "Shield", labelAr: "الدفاع المدني", labelEn: "Civil Defense" },
];

// Technical Sub-tabs
export const technicalSubTabs = [
  { id: "ARCHITECTURAL", icon: "Building2", labelAr: "المعماري", labelEn: "Architectural" },
  { id: "STRUCTURAL", icon: "HardHat", labelAr: "الإنشائي", labelEn: "Structural" },
  { id: "ELECTRICAL", icon: "Zap", labelAr: "الكهربائي", labelEn: "Electrical" },
  { id: "PLUMBING", icon: "Droplets", labelAr: "السباكة", labelEn: "Plumbing" },
  { id: "gov-approvals", icon: "Landmark", labelAr: "الموافقات الحكومية", labelEn: "Gov Approvals" },
  { id: "boq", icon: "Calculator", labelAr: "جدول الكميات", labelEn: "BOQ" },
  { id: "change-orders", icon: "FileEdit", labelAr: "أوامر التغيير", labelEn: "Change Orders" },
  { id: "risks", icon: "ShieldAlert", labelAr: "المخاطر", labelEn: "Risks" },
];

// Documents Sub-tabs
export const documentsSubTabs = [
  { id: "contract", icon: "FileSignature", labelAr: "العقد", labelEn: "Contract" },
  { id: "documents", icon: "FileText", labelAr: "المستندات", labelEn: "Documents" },
  { id: "municipality", icon: "Landmark", labelAr: "المراسلات البلدية", labelEn: "Municipality" },
];

// Financial Sub-tabs
export const financialSubTabs = [
  { id: "invoices", icon: "Receipt", labelAr: "الفواتير", labelEn: "Invoices" },
  { id: "payments", icon: "CreditCard", labelAr: "المدفوعات", labelEn: "Payments" },
  { id: "budgets", icon: "PiggyBank", labelAr: "الميزانية", labelEn: "Budget" },
  { id: "proposals", icon: "FileSpreadsheet", labelAr: "العروض", labelEn: "Proposals" },
  { id: "bids", icon: "Gavel", labelAr: "العطاءات", labelEn: "Bids" },
];

// Site Sub-tabs
export const siteSubTabs = [
  { id: "clients", icon: "Users", labelAr: "العملاء", labelEn: "Clients" },
  { id: "site-visits", icon: "Eye", labelAr: "زيارات الموقع", labelEn: "Site Visits" },
  { id: "site-diary", icon: "BookOpen", labelAr: "يومية الموقع", labelEn: "Site Diary" },
  { id: "rfi", icon: "MessageSquareQuote", labelAr: "طلبات المعلومات", labelEn: "RFI" },
  { id: "defects", icon: "AlertTriangle", labelAr: "العيوب", labelEn: "Defects" },
];

// Team Sub-tabs
export const teamSubTabs = [
  { id: "team-members", icon: "UsersRound", labelAr: "الفريق", labelEn: "Team" },
  { id: "meetings", icon: "Video", labelAr: "الاجتماعات", labelEn: "Meetings" },
  { id: "approvals", icon: "ClipboardCheck", labelAr: "الموافقات", labelEn: "Approvals" },
  { id: "notifications", icon: "Bell", labelAr: "الإشعارات", labelEn: "Notifications" },
  { id: "activity-log", icon: "Activity", labelAr: "سجل النشاط", labelEn: "Activity Log" },
];

// Help Sub-tabs
export const helpSubTabs = [
  { id: "ai-assistant", icon: "Sparkles", labelAr: "المساعد الذكي", labelEn: "AI Assistant" },
  { id: "knowledge", icon: "BookMarked", labelAr: "قاعدة المعرفة", labelEn: "Knowledge" },
  { id: "calendar", icon: "Calendar", labelAr: "التقويم", labelEn: "Calendar" },
  { id: "search", icon: "Search", labelAr: "البحث", labelEn: "Search" },
];

export const pageTitleMap: Record<string, { ar: string; en: string }> = {
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  projects: { ar: "المشاريع", en: "Projects" },
  clients: { ar: "العملاء", en: "Clients" },
  contractors: { ar: "المقاولون", en: "Contractors" },
  "finance-revenue": { ar: "الإيرادات", en: "Revenue" },
  "finance-expenses": { ar: "المصروفات", en: "Expenses" },
  "finance-reports": { ar: "التقارير المالية", en: "Financial Reports" },
  employees: { ar: "الموظفين", en: "Employees" },
  "features-hub": { ar: "المميزات المتقدمة", en: "Advanced Features" },
  "ai-assistant": { ar: "المساعد الذكي", en: "AI Assistant" },
  knowledge: { ar: "قاعدة المعرفة", en: "Knowledge Base" },
  calendar: { ar: "التقويم", en: "Calendar" },
  search: { ar: "البحث", en: "Search" },
  admin: { ar: "إدارة النظام", en: "System Admin" },
  settings: { ar: "الإعدادات", en: "Settings" },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  "finance-retainage": { ar: "إدارة الاحتجاز", en: "Retainage Management" },
  "finance-guarantees": { ar: "خطابات الضمان", en: "Guarantee Letters" },
  "finance-progress-claims": { ar: "مطالبات التقدم", en: "Progress Claims" },
  "crm-leads": { ar: "العملاء المحتملين", en: "CRM Leads" },
};

