import { create } from "zustand";

interface AppRouter {
  push: (href: string) => void;
}

interface NavStore {
  currentPage: string;
  currentProjectId: string | null;
  currentProjectTab: string;
  currentProjectSubTab: string;
  router: AppRouter | null;
  setRouter: (router: AppRouter | null) => void;
  setCurrentPage: (page: string) => void;
  setCurrentProjectId: (id: string | null) => void;
  setCurrentProjectTab: (tab: string) => void;
  setCurrentProjectSubTab: (subTab: string) => void;
  initFromUrl: () => void;
}

/**
 * Map page IDs to Next.js route paths.
 * This enables a gradual migration from hash-based routing to file-based routing.
 * 
 * Pages not in this map will continue to use hash-based routing.
 * As pages are migrated to Next.js file-based routes, add them here.
 */
const PAGE_ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  clients: "/dashboard/clients",
  "crm-leads": "/dashboard/crm",
  projects: "/dashboard/projects",
  "projects-viewer": "/dashboard/projects",
  contractors: "/dashboard/contractors",
  employees: "/dashboard/employees",
  "finance-revenue": "/dashboard/finance/revenue",
  "finance-expenses": "/dashboard/finance/expenses",
  "finance-reports": "/dashboard/finance/reports",
  "finance-retainage": "/dashboard/finance/retainage",
  "finance-guarantees": "/dashboard/finance/guarantees",
  "finance-progress-claims": "/dashboard/finance/progress-claims",
  "finance-accounts": "/dashboard/finance/accounts",
  "finance-journal-entries": "/dashboard/finance/journal-entries",
  "finance-accounting-reports": "/dashboard/finance/accounting-reports",
  "ai-assistant": "/dashboard/ai-assistant",
  knowledge: "/dashboard/knowledge",
  calendar: "/dashboard/calendar",
  search: "/dashboard/search",
  admin: "/dashboard/admin",
  "features-hub": "/dashboard/features-hub",
  settings: "/dashboard/settings",
  notifications: "/dashboard/notifications",
  tasks: "/dashboard/tasks",
  invoices: "/dashboard/invoices",
  payments: "/dashboard/payments",
  proposals: "/dashboard/proposals",
  bids: "/dashboard/bids",
  budgets: "/dashboard/budgets",
  contracts: "/dashboard/contracts",
  documents: "/dashboard/documents",
  "field-portal": "/dashboard/field-portal",
  "site-visits": "/dashboard/site-visits",
  "site-diary": "/dashboard/site-diary",
  rfi: "/dashboard/rfi",
  defects: "/dashboard/defects",
  submittals: "/dashboard/submittals",
  "change-orders": "/dashboard/change-orders",
  meetings: "/dashboard/meetings",
  transmittals: "/dashboard/transmittals",
  risks: "/dashboard/risks",
  "activity-log": "/dashboard/activity-log",
  tenders: "/dashboard/tenders",
  gantt: "/dashboard/gantt",
  reports: "/dashboard/reports",
  help: "/dashboard/help",
  profile: "/dashboard/profile",
  attendance: "/dashboard/attendance",
  leave: "/dashboard/leave",
  timesheets: "/dashboard/timesheets",
  workload: "/dashboard/workload",
  automations: "/dashboard/automations",
  "recurring-invoices": "/dashboard/recurring-invoices",
  "progress-claims": "/dashboard/progress-claims",
  "guarantee-letters": "/dashboard/guarantee-letters",
  "municipality-correspondence": "/dashboard/municipality-correspondence",
  "design-management": "/dashboard/design-management",
  inspections: "/dashboard/inspections",
  "site-rfi": "/dashboard/rfi",
  "site-defects": "/dashboard/defects",
  "site-submittals": "/dashboard/submittals",
  "site-change-orders": "/dashboard/change-orders",
  "financial-invoices": "/dashboard/invoices",
  "financial-payments": "/dashboard/payments",
  "financial-proposals": "/dashboard/proposals",
  "financial-bids": "/dashboard/bids",
  "financial-budgets": "/dashboard/budgets",
  "hr-employees": "/dashboard/employees",
  "hr-attendance": "/dashboard/attendance",
  "hr-leave": "/dashboard/leave",
  "hr-workload": "/dashboard/workload",
  "procurement-suppliers": "/dashboard/suppliers",
  "procurement-inventory": "/dashboard/inventory",
  "procurement-purchase-orders": "/dashboard/purchase-orders",
  "procurement-equipment": "/dashboard/equipment",
  boq: "/dashboard/boq",
  supervision: "/dashboard/supervision",
  "report-builder": "/dashboard/report-builder",
  "project-templates": "/dashboard/project-templates",
  approvals: "/dashboard/approvals",
  commissions: "/dashboard/commissions",
  suppliers: "/dashboard/suppliers",
  inventory: "/dashboard/inventory",
  "purchase-orders": "/dashboard/purchase-orders",
  equipment: "/dashboard/equipment",
  billing: "/dashboard/billing",
  "retainage-page": "/dashboard/finance/retainage",
  "team-members": "/dashboard/team-members",
  "client-detail": "/dashboard/clients",
  "project-form": "/dashboard/projects",
};

/**
 * Check if file-based routing should be used.
 * Controlled by environment variable. File-based routing is now the DEFAULT
 * (set NEXT_PUBLIC_FILE_ROUTING=false to opt back into legacy hash-based routing).
 * NOTE: Not a React hook — reads a static env var, no state or effects.
 */
function isFileBasedRoutingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NEXT_PUBLIC_FILE_ROUTING !== "false";
}

function getPageFromUrl(): string {
  if (typeof window === "undefined") return "dashboard";
  
  // If using file-based routing, derive page from pathname
  if (isFileBasedRoutingEnabled()) {
    const pathname = window.location.pathname;
    const dashboardPath = pathname.replace("/dashboard", "").replace(/^\/|\/$/g, "");
    if (!dashboardPath) return "dashboard";
    // Convert path like "finance/revenue" to "finance-revenue"
    return dashboardPath.replace(/\//g, "-");
  }
  
  // Fallback: hash-based routing
  const hash = window.location.hash.replace("#", "");
  return hash.split("/")[0] || "dashboard";
}

function getProjectIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  
  // If using file-based routing, get from pathname
  if (isFileBasedRoutingEnabled()) {
    const pathname = window.location.pathname;
    const match = pathname.match(/\/dashboard\/projects\/([^/]+)/);
    return match ? match[1] : null;
  }
  
  // Fallback: hash-based routing
  const hash = window.location.hash.replace("#", "");
  const parts = hash.split("/");
  return parts[1] || null;
}

export const useNavStore = create<NavStore>()((set, get) => ({
  currentPage: "dashboard",
  currentProjectId: null,
  currentProjectTab: "overview",
  currentProjectSubTab: "",
  router: null,
  setRouter: (router) => set({ router }),

  setCurrentPage: (page) => {
    set({ currentPage: page });
    
    if (typeof window !== "undefined") {
      // If file-based routing is enabled, navigate via Next.js router
      if (isFileBasedRoutingEnabled()) {
        const route = PAGE_ROUTE_MAP[page];
        if (route) {
          const { currentProjectId, router } = get();
          const targetPath = (page === "projects" && currentProjectId)
            ? `${route}/${currentProjectId}`
            : (page === "projects-viewer" && currentProjectId)
            ? `${route}/${currentProjectId}/viewer`
            : route;
          
          if (router) {
            router.push(targetPath);
          } else {
            // Use pushState for SPA navigation without full page reload
            if (window.location.pathname !== targetPath) {
              window.history.pushState({}, "", targetPath);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
          }
          return;
        }
        // If no route mapping, fall through to hash-based
      }
      
      // Hash-based routing fallback
      const { currentProjectId } = get();
      if (currentProjectId && page === "projects") {
        window.location.hash = `${page}/${currentProjectId}`;
      } else {
        window.location.hash = page;
      }
    }
  },

  setCurrentProjectId: (id) => {
    set({ currentProjectId: id, currentProjectTab: "overview", currentProjectSubTab: "" });
    
    if (typeof window !== "undefined") {
      if (isFileBasedRoutingEnabled()) {
        const { currentPage, router } = get();
        const baseRoute = PAGE_ROUTE_MAP[currentPage] || "/dashboard/projects";
        const targetPath = id ? `${baseRoute}/${id}` : baseRoute;
        
        if (router) {
          router.push(targetPath);
        } else {
          if (window.location.pathname !== targetPath) {
            window.history.pushState({}, "", targetPath);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        }
        return;
      }
      
      // Hash-based fallback
      const { currentPage } = get();
      const basePage = currentPage || "projects";
      if (id) {
        window.location.hash = `${basePage}/${id}`;
      } else {
        window.location.hash = basePage;
      }
    }
  },

  setCurrentProjectTab: (tab) => set({ currentProjectTab: tab, currentProjectSubTab: "" }),
  setCurrentProjectSubTab: (subTab) => set({ currentProjectSubTab: subTab }),

  initFromUrl: () => {
    const page = getPageFromUrl();
    const projectId = getProjectIdFromUrl();
    set({ currentPage: page, currentProjectId: projectId });
  },
}));

export { PAGE_ROUTE_MAP };
