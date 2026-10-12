import { orgCheck, type AuthContext } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { hasPermission } from '@/lib/auth/modules/authorization';

import { db, isDatabaseAvailable } from '@/lib/db';
import { log } from '@/lib/logger';
import { CONSTRUCTION_COSTS_RAK } from '@/lib/ai/engineering-knowledge';

// AIChatConversation and AIChatMessage are now accessed directly via db.aIChatConversation
// and db.aIChatMessage since all Prisma models are generated.

// ============================================
// ZAI SDK — Lazy-load + Direct HTTP fallback
// ============================================
// The ZAI SDK reads from .z-ai-config file, but on local dev machines
// that file may not exist. So we use a two-tier approach:
//   1. Try the ZAI SDK (requires .z-ai-config)
//   2. Fall back to direct HTTP call using env vars (ZAI_BASE_URL, etc.)
// This way it works BOTH on the hosted server AND on local machines.

let ZAISdk: typeof import('z-ai-web-dev-sdk').default | null = null;
export async function getZAI() {
  if (!ZAISdk) {
    try {
      const mod = await import('z-ai-web-dev-sdk');
      ZAISdk = mod.default;
    } catch (importError) {
      log.warn('[AI] Failed to import z-ai-web-dev-sdk:', { error: importError instanceof Error ? importError.message : importError });
      return null;
    }
  }
  return ZAISdk;
}

/**
 * Read ZAI config directly from .z-ai-config file.
 * This is used as a backup when env vars are not set.
 * The SDK also reads this file, but we read it manually for the direct HTTP fallback.
 */
export async function readZaiConfigFile(): Promise<{ baseUrl: string; apiKey: string; chatId?: string; userId?: string; token?: string } | null> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const configPaths = [
      path.join(process.cwd(), '.z-ai-config'),
      path.join(os.homedir(), '.z-ai-config'),
      '/etc/.z-ai-config',
    ];

    for (const configPath of configPaths) {
      try {
        if (fs.existsSync(configPath)) {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (data.baseUrl && data.apiKey) {
            return data;
          }
        }
      } catch {
        // Try next path
      }
    }
  } catch {
    // Module loading failed
  }
  return null;
}

// Cache the file-based config to avoid repeated file reads
let _cachedFileConfig: Awaited<ReturnType<typeof readZaiConfigFile>> | undefined = undefined;
export async function getCachedZaiFileConfig() {
  if (_cachedFileConfig === undefined) {
    _cachedFileConfig = await readZaiConfigFile();
  }
  return _cachedFileConfig;
}

/**
 * Call ZAI backend directly via HTTP.
 * Reads config from (in priority order):
 *   1. Environment variables (ZAI_BASE_URL, ZAI_API_KEY, ZAI_CHAT_ID, ZAI_USER_ID, ZAI_TOKEN)
 *   2. .z-ai-config file (in project dir, home dir, or /etc/)
 * Throws if neither source provides baseUrl and apiKey.
 */
export async function callZaiDirect(
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  // Read from .z-ai-config file as a backup source
  const fileConfig = await getCachedZaiFileConfig();

  const baseUrl = process.env.ZAI_BASE_URL || fileConfig?.baseUrl || '';
  const apiKey = process.env.ZAI_API_KEY || fileConfig?.apiKey || '';
  const chatId = process.env.ZAI_CHAT_ID || fileConfig?.chatId || '';
  const userId = process.env.ZAI_USER_ID || fileConfig?.userId || '';
  const token = process.env.ZAI_TOKEN || fileConfig?.token || '';

  const url = `${baseUrl}/chat/completions`;
  if (!baseUrl || !apiKey) {
    throw new Error('ZAI_BASE_URL and ZAI_API_KEY must be configured for direct AI calls');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Z-AI-From': 'Z',
  };
  if (chatId) headers['X-Chat-Id'] = chatId;
  if (userId) headers['X-User-Id'] = userId;
  if (token) headers['X-Token'] = token;

  const body = {
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1500,
    thinking: { type: 'disabled' },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ZAI direct call failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

// Note: We now use database persistence instead of in-memory storage
// The conversation history is now saved in AIChatConversation and AIChatMessage tables

// Detect if user message is asking about specific topics
export function detectTopics(message: string): string[] {
  const lower = message.toLowerCase();
  const topics: string[] = [];

  // Project-related
  if (/project|مشروع|مشاريع/.test(lower)) topics.push('projects');
  // Task-related
  if (/task|مهم|مهام|مهمة|overdue|متأخر|متأخرة/.test(lower)) topics.push('tasks');
  // Financial/invoice/budget
  if (/invoice|budget|financial|فاتور|ميزاني|إيراد|revenue|payment|دفع|مستحق/.test(lower)) topics.push('financial');
  // Client-related
  if (/client|عميل|عملاء/.test(lower)) topics.push('clients');
  // HR/employee
  if (/employee|hr|موظف|مندوب|حضور|attendance|leave|إجاز/.test(lower)) topics.push('hr');
  // Site management
  if (/site|visit|defect|موقع|زيار|عيب/.test(lower)) topics.push('site');
  // Dashboard/summary/stats
  if (/dashboard|summary|stats|لوحة|ملخص|إحصائي|overview/.test(lower)) topics.push('dashboard');
  // Contract
  if (/contract|عقد|عقود/.test(lower)) topics.push('contracts');
  // Alert/notification
  if (/alert|notification|تنبيه|إشعار|warning|خطر/.test(lower)) topics.push('alerts');
  // Contractors / bids / tenders / evaluation
  if (/contractor|مقاول|عطاء|مناقص|تقييم مقاول|bid|tender|عرض سعر/.test(lower)) topics.push('contractors');
  // Team / members / assignments
  if (/team|فريق|أعضاء|assignment|توزيع|کار|staff/.test(lower)) topics.push('team');
  // Reports / statistics
  if (/report|تقرير|تقارير|إحصائ/.test(lower)) topics.push('reports');

  // Engineering-specific topics
  if (/structural|إنشائي|خرسانة|حديد|أساس|عمود|كمرة|بلاطة|concrete|steel|foundation|rebar/.test(lower)) topics.push('engineering-structural');
  if (/mep|كهرباء|تكييف|سباكة|HVAC|electrical|plumbing|fire fighting|إطفاء/.test(lower)) topics.push('engineering-mep');
  if (/cost|تكلفة|سعر|ميزانية|كلفة|price|budget|estimate|BOQ|كميات|تقدير/.test(lower)) topics.push('engineering-cost');
  if (/regulation|بلدية|دفاع مدني|ترخيص|municipality|permit|code|FEWA|DEWA|ADDC|كود|مواصفات/.test(lower)) topics.push('engineering-regulation');
  if (/calculation|حساب|حمل|تصميم|design|load|dimension|حمل|إجهاد|بعد/.test(lower)) topics.push('engineering-calculation');
  if (/تربة|soil|geotechnical|حفر|borehole|جيولوجيا/.test(lower)) topics.push('engineering-soil');

  return topics;
}

// Fetch context data based on detected topics — with RBAC enforcement
// SECURITY: Only fetch data for entity types the user has read permission for
export async function fetchContextData(topics: string[], userRole: string, userId?: string, projectId?: string, organizationId?: string | null) {
  const context: Record<string, unknown> = {};

  // Guard: if database is unavailable, return empty context
  if (!await isDatabaseAvailable()) {
    log.warn('[AI Chat] Database unavailable, skipping context data fetch');
    return context;
  }

  // RBAC: Pre-compute which data types this user can access
  const canReadProjects = hasPermission(userRole, Permission.PROJECT_READ);
  const canReadTasks = hasPermission(userRole, Permission.TASK_READ);
  const canReadClients = hasPermission(userRole, Permission.CLIENT_READ);
  const canReadInvoices = hasPermission(userRole, Permission.INVOICE_READ);
  const canReadContracts = hasPermission(userRole, Permission.CONTRACT_READ);
  const canReadContractors = hasPermission(userRole, Permission.CONTRACTOR_READ);
  const canReadBids = hasPermission(userRole, Permission.BID_READ);
  const canReadEmployees = hasPermission(userRole, Permission.EMPLOYEE_READ);
  const canReadDefects = hasPermission(userRole, Permission.DEFECT_READ);
  const canReadSiteDiary = hasPermission(userRole, Permission.SITE_DIARY_READ);
  const _canReadDocuments = hasPermission(userRole, Permission.DOCUMENT_READ);
  const canReadPayments = hasPermission(userRole, Permission.PAYMENT_READ);
  const canReadReports = hasPermission(userRole, Permission.REPORTS_READ);

  // Build project-specific where clause
  const projectWhere: Record<string, unknown> = projectId ? { projectId } : {};

  // Multi-tenancy: build org filter for all queries
  // Multi-tenancy: in multi-tenant mode without orgId, deny by omitting organizationId
  // so queries will return no results
  const orgWhere: Record<string, unknown> = organizationId
    ? { organizationId }
    : (process.env.MULTI_TENANT === 'true' ? { organizationId: undefined } : {});

  // Merge org filter into projectWhere for project-scoped queries
  const projectAndOrgWhere = { ...projectWhere, ...orgWhere };

  try {
    // Always fetch basic dashboard stats for context — only include counts for permitted entities
    if (topics.includes('dashboard') || topics.length === 0) {
      const [totalProjects, activeProjects, completedProjects, delayedProjects, totalTasks, totalClients] =
        await Promise.all([
          canReadProjects ? (projectId ? db.project.count({ where: { id: projectId, ...orgWhere } }) : db.project.count({ where: orgWhere })) : 0,
          canReadProjects ? (projectId ? db.project.count({ where: { id: projectId, status: 'ACTIVE', ...orgWhere } }) : db.project.count({ where: { status: 'ACTIVE', ...orgWhere } })) : 0,
          canReadProjects ? (projectId ? db.project.count({ where: { id: projectId, status: 'COMPLETED', ...orgWhere } }) : db.project.count({ where: { status: 'COMPLETED', ...orgWhere } })) : 0,
          canReadProjects ? (projectId ? db.project.count({ where: { id: projectId, status: 'DELAYED', ...orgWhere } }) : db.project.count({ where: { status: 'DELAYED', ...orgWhere } })) : 0,
          canReadTasks ? db.task.count({ where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : undefined }) : 0,
          canReadClients ? db.client.count({ where: orgWhere }) : 0,
        ]);
      context.dashboardStats = { totalProjects, activeProjects, completedProjects, delayedProjects, totalTasks, totalClients };
    }

    // Projects — requires PROJECT_READ
    if (topics.includes('projects') && canReadProjects) {
      const recentProjects = await db.project.findMany({
        where: projectId ? { id: projectId, ...orgWhere } : orgWhere,
        orderBy: { updatedAt: 'desc' },
        take: projectId ? 1 : 8,
        include: {
          client: { select: { name: true, company: true } },
        },
      });
      context.projects = recentProjects.map(p => ({
        number: p.number,
        name: p.name,
        nameEn: p.nameEn,
        clientName: p.client?.name || p.client?.company || '',
        status: p.status,
        progress: p.progress,
        budget: p.budget,
        location: p.location,
        type: p.type,
        startDate: p.startDate?.toISOString(),
        endDate: p.endDate?.toISOString(),
      }));

      // Delayed projects specifically
      const delayedProjects = recentProjects.filter(p => p.status === 'DELAYED');
      if (delayedProjects.length > 0) {
        context.delayedProjects = delayedProjects.map(p => ({
          number: p.number,
          name: p.name,
          progress: p.progress,
          endDate: p.endDate?.toISOString(),
          clientName: p.client?.name || p.client?.company || '',
        }));
      }
    }

    // Tasks — requires TASK_READ
    if (topics.includes('tasks') && canReadTasks) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const overdueTasks = await db.task.findMany({
        where: {
          ...projectAndOrgWhere,
          status: { notIn: ['DONE', 'CANCELLED'] },
          dueDate: { not: null, lt: startOfDay },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: {
          project: { select: { number: true, name: true } },
          assignee: { select: { name: true } },
        },
      });

      const userTasks = userId ? await db.task.findMany({
        where: {
          ...projectAndOrgWhere,
          assigneeId: userId,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        orderBy: { dueDate: 'asc' },
        take: 8,
        include: {
          project: { select: { number: true, name: true } },
        },
      }) : [];

      context.tasks = {
        OVERDUE: overdueTasks.map(t => ({
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString(),
          projectName: t.project?.name || '',
          assigneeName: t.assignee?.name || '',
          status: t.status,
        })),
        userTasks: userTasks.map(t => ({
          title: t.title,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString(),
          status: t.status,
          projectName: t.project?.name || '',
          progress: t.progress,
        })),
        overdueCount: overdueTasks.length,
        userTasksCount: userTasks.length,
      };
    }

    // Financial — requires INVOICE_READ and PAYMENT_READ
    if (topics.includes('financial') && canReadInvoices) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [invoices, payments] = await Promise.all([
        db.invoice.findMany({
          where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : undefined,
          orderBy: { issueDate: 'desc' },
          take: 8,
          include: {
            client: { select: { name: true, company: true } },
          },
        }),
        canReadPayments ? db.payment.findMany({
          where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : undefined,
          orderBy: { createdAt: 'desc' },
          take: 5,
        }) : [],
      ]);

      const paidInvoices = await db.invoice.findMany({
        where: {
          ...(Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : {}),
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
          paidAmount: { gt: 0 },
          issueDate: { gte: sixMonthsAgo },
        },
        select: { paidAmount: true, issueDate: true },
      });

      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE');
      const outstandingTotal = invoices
        .filter(i => ['OVERDUE', 'SENT', 'PARTIALLY_PAID'].includes(i.status))
        .reduce((sum, i) => sum + Number(i.remaining), 0);

      context.financial = {
        totalRevenue: Math.round(totalRevenue),
        overdueInvoices: overdueInvoices.map(i => ({
          number: i.number,
          total: i.total,
          remaining: i.remaining,
          dueDate: i.dueDate?.toISOString(),
          clientName: i.client?.name || i.client?.company || '',
        })),
        overdueCount: overdueInvoices.length,
        outstandingTotal: Math.round(outstandingTotal),
        recentPayments: payments.map(p => ({
          voucherNumber: p.voucherNumber,
          amount: p.amount,
          status: p.status,
          description: p.description,
        })),
      };
    }

    // Clients — requires CLIENT_READ
    if (topics.includes('clients') && canReadClients) {
      const clients = await db.client.findMany({
        where: orgWhere,
        take: 10,
        include: {
          _count: { select: { projects: true, invoices: true, contracts: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      context.clients = clients.map(c => ({
        name: c.name,
        COMPANY: c.company,
        phone: c.phone,
        EMAIL: c.email,
        projectCount: c._count.projects,
        invoiceCount: c._count.invoices,
        contractCount: c._count.contracts,
        creditLimit: c.creditLimit,
      }));
    }

    // HR — requires EMPLOYEE_READ
    if (topics.includes('hr') && canReadEmployees) {
      const [employees, pendingLeaves] = await Promise.all([
        db.employee.findMany({
          where: orgWhere,
          take: 8,
          include: { user: { select: { name: true, email: true, isActive: true } } },
        }),
        db.leave.findMany({
          where: { status: 'PENDING', ...orgWhere },
          take: 5,
          include: {
            employee: { select: { name: true } },
          },
        }),
      ]);

      context.hr = {
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.user?.isActive).length,
        pendingLeaves: pendingLeaves.map(l => ({
          employeeName: l.employee?.name || '',
          type: l.type,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          days: l.days,
          reason: l.reason,
        })),
        pendingLeaveCount: pendingLeaves.length,
        departments: [...new Set(employees.map(e => e.department).filter(Boolean))],
      };
    }

    // Site management — requires SITE_DIARY_READ and DEFECT_READ
    if (topics.includes('site') && (canReadSiteDiary || canReadDefects)) {
      const [siteVisits, openDefects] = await Promise.all([
        canReadSiteDiary ? db.siteVisit.findMany({
          where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : undefined,
          orderBy: { date: 'desc' },
          take: 5,
          include: {
            project: { select: { number: true, name: true } },
          },
        }) : [],
        canReadDefects ? db.defect.findMany({
          where: {
            ...(Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : {}),
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          take: 8,
          include: {
            project: { select: { number: true, name: true } },
          },
        }) : [],
      ]);

      context.site = {
        recentVisits: siteVisits.map(v => ({
          date: v.date.toISOString(),
          municipality: v.municipality,
          plotNumber: v.plotNumber,
          projectName: v.project?.name || '',
          status: v.status,
        })),
        openDefects: openDefects.map(d => ({
          title: d.title,
          severity: d.severity,
          status: d.status,
          projectName: d.project?.name || '',
          location: d.location,
        })),
        openDefectCount: openDefects.length,
        criticalDefectCount: openDefects.filter(d => d.severity === 'CRITICAL').length,
      };
    }

    // Contracts — requires CONTRACT_READ
    if (topics.includes('contracts') && canReadContracts) {
      const contracts = await db.contract.findMany({
        where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere,
        take: 8,
        include: {
          client: { select: { name: true, company: true } },
          project: { select: { number: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      context.contracts = contracts.map(c => ({
        number: c.number,
        title: c.title,
        clientName: c.client?.name || c.client?.company || '',
        projectName: c.project?.name || '',
        value: c.value,
        status: c.status,
        type: c.type,
        startDate: c.startDate?.toISOString(),
        endDate: c.endDate?.toISOString(),
      }));
    }

    // Alerts — mixed permissions required per sub-entity
    if (topics.includes('alerts')) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const [overdueInvoices, overdueTasks, pendingGovApprovals] = await Promise.all([
        canReadInvoices ? db.invoice.findMany({
          where: {
            ...(Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : {}),
            status: 'OVERDUE',
          },
          take: 5,
          include: { client: { select: { name: true, company: true } } },
        }) : [],
        canReadTasks ? db.task.findMany({
          where: {
            ...projectAndOrgWhere,
            status: { notIn: ['DONE', 'CANCELLED'] },
            dueDate: { lt: startOfDay },
          },
          take: 5,
          include: {
            project: { select: { name: true } },
            assignee: { select: { name: true } },
          },
        }) : [],
        canReadProjects ? db.govApproval.findMany({
          where: {
            ...(Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : {}),
            status: { in: ['PENDING', 'SUBMITTED'] },
          },
          take: 5,
          include: { project: { select: { number: true, name: true } } },
        }) : [],
      ]);

      context.alerts = {
        overdueInvoices: overdueInvoices.map(i => ({
          number: i.number,
          remaining: i.remaining,
          dueDate: i.dueDate?.toISOString(),
          clientName: i.client?.name || i.client?.company || '',
        })),
        overdueTasks: overdueTasks.map(t => ({
          title: t.title,
          dueDate: t.dueDate?.toISOString(),
          projectName: t.project?.name || '',
          assigneeName: t.assignee?.name || '',
        })),
        pendingGovApprovals: pendingGovApprovals.map(g => ({
          authority: g.authority,
          projectName: g.project?.name || '',
          projectNumber: g.project?.number || '',
          status: g.status,
        })),
        summary: {
          overdueInvoiceCount: overdueInvoices.length,
          overdueTaskCount: overdueTasks.length,
          pendingGovApprovalCount: pendingGovApprovals.length,
          totalAlerts: overdueInvoices.length + overdueTasks.length + pendingGovApprovals.length,
        },
      };
    }

    // Contractors / Bids / Tenders — requires CONTRACTOR_READ and BID_READ
    if (topics.includes('contractors') && (canReadContractors || canReadBids)) {
      const [contractors, bids] = await Promise.all([
        canReadContractors ? db.contractor.findMany({
          where: orgWhere,
          take: 10,
          orderBy: { rating: 'desc' },
        }) : [],
        canReadBids ? db.bid.findMany({
          where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere,
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            contractor: { select: { id: true, name: true, companyName: true, rating: true, category: true } },
            project: { select: { number: true, name: true } },
            evaluations: {
              select: { criteria: true, score: true, maxScore: true, weight: true, notes: true },
            },
          },
        }) : [],
      ]);

      // Compute average evaluation scores for each bid
      const bidsWithEval = bids.map(b => {
        const evals = b.evaluations;
        const totalWeight = evals.reduce((sum, e) => sum + Number(e.weight), 0);
        const weightedScore = evals.reduce((sum, e) => sum + (Number(e.score) / Number(e.maxScore)) * Number(e.weight), 0);
        const avgScore = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : null;
        return {
          id: b.id,
          contractorName: b.contractorName || b.contractor?.name || '',
          contractorCompany: b.contractor?.companyName || '',
          contractorRating: b.contractor?.rating || 0,
          contractorCategory: b.contractor?.category || '',
          projectName: b.project?.name || '',
          projectNumber: b.project?.number || '',
          amount: b.amount,
          technicalScore: b.technicalScore,
          financialScore: b.financialScore,
          totalScore: b.totalScore,
          evaluationAverageScore: avgScore,
          status: b.status,
          deadline: b.deadline?.toISOString(),
          evaluationCriteria: evals.map(e => ({
            criteria: e.criteria,
            score: e.score,
            maxScore: e.maxScore,
            weight: e.weight,
          })),
          notes: b.evaluationNotes,
        };
      });

      context.contractors = {
        list: contractors.map(c => ({
          id: c.id,
          name: c.name,
          nameEn: c.nameEn,
          companyName: c.companyName,
          companyEn: c.companyEn,
          contactPerson: c.contactPerson,
          phone: c.phone,
          EMAIL: c.email,
          category: c.category,
          rating: c.rating,
          specialties: c.specialties,
          crNumber: c.crNumber,
          licenseNumber: c.licenseNumber,
          licenseExpiry: c.licenseExpiry?.toISOString(),
        })),
        totalContractors: contractors.length,
      };

      context.bids = {
        list: bidsWithEval,
        totalCount: bids.length,
        SUBMITTED: bids.filter(b => b.status === 'SUBMITTED').length,
        underReview: bids.filter(b => b.status === 'UNDER_REVIEW').length,
        ACCEPTED: bids.filter(b => b.status === 'ACCEPTED').length,
        REJECTED: bids.filter(b => b.status === 'REJECTED').length,
      };
    }

    // Team / Project Members — requires EMPLOYEE_READ
    if (topics.includes('team') && canReadEmployees) {
      // Get project assignments if projectId is provided, otherwise get recent team activity
      if (projectId) {
        const assignments = await db.projectAssignment.findMany({
          where: { projectId, ...orgWhere },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                department: true,
                position: true,
                isActive: true,
              },
            },
          },
        });

        // Get task counts per team member for this project — single batch query
        const allTaskCounts = await db.task.groupBy({
          by: ['assigneeId', 'status'],
          where: { projectId, ...orgWhere },
          _count: true,
        });

        // Build a map: userId -> { status -> count }
        const taskCountMap = new Map<string, Record<string, number>>();
        for (const tc of allTaskCounts) {
          if (!tc.assigneeId) continue;
          if (!taskCountMap.has(tc.assigneeId)) {
            taskCountMap.set(tc.assigneeId, {});
          }
          taskCountMap.get(tc.assigneeId)![tc.status] = tc._count;
        }

        const teamTaskStats = assignments.map(a => ({
          userId: a.userId,
          userName: a.user.name,
          userRole: a.role,
          department: a.user.department,
          position: a.user.position,
          isActive: a.user.isActive,
          taskCounts: taskCountMap.get(a.userId) || {},
        }));

        context.team = {
          projectId,
          members: assignments.map(a => ({
            userId: a.user.id,
            name: a.user.name,
            email: a.user.email,
            department: a.user.department,
            position: a.user.position,
            role: a.role,
            isActive: a.user.isActive,
          })),
          memberCount: assignments.length,
          taskStats: teamTaskStats,
        };
      } else {
        // Show overall team distribution across projects
        const activeProjectsWithTeam = await db.project.findMany({
          where: { status: { in: ['ACTIVE', 'DELAYED'] }, ...orgWhere },
          take: 5,
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true, department: true, position: true } },
              },
            },
          },
        });

        context.team = {
          projectTeams: activeProjectsWithTeam.map(p => ({
            projectName: p.name,
            projectNumber: p.number,
            status: p.status,
            members: p.assignments.map(a => ({
              name: a.user.name,
              department: a.user.department,
              position: a.user.position,
              role: a.role,
            })),
          })),
        };
      }
    }

    // Reports / Statistics summary — requires REPORTS_READ
    if (topics.includes('reports') && canReadReports) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        projectCount,
        activeProjects,
        completedThisMonth,
        taskStats,
        financialSummary,
        siteVisitCount,
        openDefectCount,
        contractorCount,
        pendingBidsCount,
        teamMemberCount,
      ] = await Promise.all([
        canReadProjects ? db.project.count(Object.keys(projectAndOrgWhere).length > 0 ? { where: projectAndOrgWhere } : { where: orgWhere }) : 0,
        canReadProjects ? db.project.count({ where: { ...Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere, status: 'ACTIVE' } }) : 0,
        canReadProjects ? db.project.count({
          where: { ...Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere, status: 'COMPLETED', updatedAt: { gte: startOfMonth } },
        }) : 0,
        canReadTasks ? db.task.groupBy({
          by: ['status'],
          where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere,
          _count: true,
        }) : [],
        canReadInvoices ? db.invoice.aggregate({
          where: Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere,
          _sum: { total: true, paidAmount: true, remaining: true },
          _count: true,
        }) : { _sum: { total: 0, paidAmount: 0, remaining: 0 }, _count: 0 },
        canReadSiteDiary ? db.siteVisit.count({
          where: Object.keys(projectAndOrgWhere).length > 0 ? { ...projectAndOrgWhere, date: { gte: startOfMonth } } : { ...orgWhere, date: { gte: startOfMonth } },
        }) : 0,
        canReadDefects ? db.defect.count({
          where: { ...Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        }) : 0,
        canReadContractors ? db.contractor.count({ where: orgWhere }) : 0,
        canReadBids ? db.bid.count({
          where: { ...Object.keys(projectAndOrgWhere).length > 0 ? projectAndOrgWhere : orgWhere, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        }) : 0,
        canReadEmployees ? db.projectAssignment.groupBy({
          by: ['projectId'],
          _count: true,
        }) : [],
      ]);

      const taskBreakdown: Record<string, number> = {};
      taskStats.forEach(ts => { taskBreakdown[ts.status] = ts._count; });

      context.reports = {
        projectStats: {
          total: projectCount,
          ACTIVE: activeProjects,
          completedThisMonth,
        },
        taskBreakdown,
        totalTasks: taskStats.reduce((sum, ts) => sum + ts._count, 0),
        FINANCIAL: {
          totalInvoiced: financialSummary._sum.total || 0,
          totalCollected: financialSummary._sum.paidAmount || 0,
          totalOutstanding: financialSummary._sum.remaining || 0,
          invoiceCount: financialSummary._count,
        },
        siteStats: {
          visitsThisMonth: siteVisitCount,
          openDefects: openDefectCount,
        },
        contractorStats: {
          totalContractors: contractorCount,
          pendingBids: pendingBidsCount,
        },
        teamStats: {
          totalAssignments: teamMemberCount.reduce((sum, tm) => sum + tm._count, 0),
          projectsWithTeam: teamMemberCount.length,
        },
        period: 'current',
      };
    }

    // Engineering-specific context - fetch BOQ and material data
    if (topics.some(t => t.startsWith('engineering-'))) {
      if (projectId) {
        // Fetch project BOQ items if available
        try {
          const boqItems = await db.bOQItem?.findMany({
            where: { projectId },
            take: 20,
            orderBy: { createdAt: 'desc' },
          });
          if (boqItems && boqItems.length > 0) {
            context.engineeringBOQ = boqItems.map((item: Record<string, unknown>) => ({
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              category: item.category,
            }));
          }
        } catch {
          // BOQ model may not exist
        }

        // Fetch site reports for engineering context
        try {
          const siteReports = await db.siteDiary?.findMany({
            where: { projectId },
            take: 5,
            orderBy: { date: 'desc' },
          });
          if (siteReports && siteReports.length > 0) {
            context.recentSiteReports = siteReports.map((r: Record<string, unknown>) => ({
              date: (r.date as Date)?.toISOString?.(),
              weather: r.weather,
              workers: r.workersCount,
              summary: r.summary,
            }));
          }
        } catch {
          // SiteReport model may not exist
        }
      }

      // Always include RAK construction cost reference data for engineering queries
      context.constructionCostsRAK = CONSTRUCTION_COSTS_RAK;
    }
  } catch (error) {
    log.error('Error fetching context data:', error);
    // Continue without context data if there's an error
  }

  return context;
}

// Fetch project context for system prompt when projectId is provided
// SECURITY: Accepts AuthContext to verify org ownership before returning data
export async function fetchProjectContext(projectId: string, ctx: AuthContext): Promise<string | null> {
  if (!await isDatabaseAvailable()) return null;
  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { name: true, company: true } },
      },
    });

    if (!project) return null;

    // SECURITY: Verify the project belongs to the user's organization
    // Without this check, any authenticated user could read any project's
    // data through the AI chat by providing a projectId from another org
    const orgError = orgCheck(ctx, project);
    if (orgError) return null;

    const statusMap: Record<string, { ar: string; en: string }> = {
      ACTIVE: { ar: 'نشط', en: 'Active' },
      COMPLETED: { ar: 'مكتمل', en: 'Completed' },
      DELAYED: { ar: 'متأخر', en: 'Delayed' },
      ON_HOLD: { ar: 'معلق', en: 'On Hold' },
      CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
    };
    const statusInfo = statusMap[project.status] || { ar: project.status, en: project.status };
    const clientName = project.client?.name || project.client?.company || 'N/A';

    return `Current project context:
- Project Number: ${project.number}
- Project Name: ${project.name} (${project.nameEn || ''})
- Status: ${statusInfo.en} / ${statusInfo.ar}
- Progress: ${project.progress}%
- Budget: ${project.budget.toLocaleString()} AED
- Client: ${clientName}
- Location: ${project.location || 'N/A'}
- Type: ${project.type || 'N/A'}
- Start Date: ${project.startDate?.toISOString().split('T')[0] || 'N/A'}
- End Date: ${project.endDate?.toISOString().split('T')[0] || 'N/A'}`;
  } catch {
    return null;
  }
}


// ============================================
// Demo Mode AI Responses (works without API keys)
// ============================================
export function getDemoResponse(message: string, language: string, contextData: Record<string, unknown>, currency = 'AED'): string {
  const isAr = language === 'ar';
  const lower = message.toLowerCase();

  // Financial & Ledger Live Analysis (QW7)
  if (/فلوس|محصل|تحصيل|إيراد|دخل|مصروف|أرباح|خسائر|دفتر|أستاذ|ميزانية|فاتور|ديون|مديون|money|revenue|expense|profit|loss|receivable|payable|invoice|ledger/.test(lower)) {
    const fin = contextData.financial as Record<string, unknown> | undefined;

    if (fin) {
      const rev = (fin.totalRevenue as number) ?? 0;
      const outstanding = (fin.outstandingTotal as number) ?? 0;
      const overdueList = Array.isArray(fin.overdueInvoices) ? (fin.overdueInvoices as Array<Record<string, unknown>>) : [];

      if (isAr) {
        let resp = `💼 **التقرير المالي الذكي المباشر:**\n\n`;
        resp += `• **إجمالي الإيرادات المحصلة:** \`${Number(rev).toLocaleString()} ${currency}\`\n`;
        resp += `• **مستحقات معلقة لدى العملاء:** \`${Number(outstanding).toLocaleString()} ${currency}\`\n`;

        if (overdueList.length > 0) {
          resp += `\n⚠️ **تنبيه فواتير متأخرة التحصيل (${overdueList.length}):**\n`;
          overdueList.slice(0, 3).forEach((inv) => {
            resp += `- فاتورة **${inv.number}** للعميل (${inv.clientName || 'غير محدد'}): المتبقي \`${Number(inv.remaining).toLocaleString()} ${currency}\`\n`;
          });
        } else {
          resp += `\n✅ لا توجد فواتير حرجة متأخرة حالياً.\n`;
        }
        resp += `\n📌 *البيانات مستخرجة لحظياً من دفتر الأستاذ العام وفواتير النظام.*`;
        return resp;
      } else {
        let resp = `💼 **Live Financial Intelligence Snapshot:**\n\n`;
        resp += `• **Total Collected Revenue:** \`${Number(rev).toLocaleString()} ${currency}\`\n`;
        resp += `• **Outstanding Receivables:** \`${Number(outstanding).toLocaleString()} ${currency}\`\n`;
        if (overdueList.length > 0) {
          resp += `\n⚠️ **Overdue Invoices Alert (${overdueList.length}):**\n`;
          overdueList.slice(0, 3).forEach((inv) => {
            resp += `- Invoice **${inv.number}** (${inv.clientName || 'N/A'}): \`${Number(inv.remaining).toLocaleString()} ${currency}\` remaining\n`;
          });
        }
        resp += `\n📌 *Data sourced live from General Ledger & invoices.*`;
        return resp;
      }
    }
  }

  // Engineering-specific demo responses — cost/construction
  if (/تكلفة|سعر|كلفة|cost|price|budget|كم|ميزانية|تقدير|estimate|BOQ|كميات/.test(lower)) {
    const projectData = contextData.projects as Array<Record<string, unknown>> | undefined;
    const projectBudget = projectData?.[0]?.budget;
    if (projectBudget) {
      return isAr
        ? `💰 **تقدير التكاليف:**\n\nميزانية المشروع الحالية: ${Number(projectBudget).toLocaleString()} درهم\n\n📊 **متوسط تكاليف البناء في رأس الخيمة (2025):**\n| النوع | الحد الأدنى | المتوسط | الحد الأقصى |\n|-------|-----------|--------|----------|\n| فيلا عادية | 2,200 | 2,700 | 3,200 |\n| فيلا فاخرة | 3,500 | 4,500 | 5,500 |\n\n*(درهم/م²)*\n\n💡 *للحصول على تحليل تفصيلي مع BOQ، قم بتهيئة مفتاح AI*`
        : `💰 **Cost Estimate:**\n\nCurrent project budget: ${Number(projectBudget).toLocaleString()} AED\n\n📊 **Average construction costs in RAK (2025):**\n| Type | Min | Avg | Max |\n|------|-----|-----|-----|\n| Standard Villa | 2,200 | 2,700 | 3,200 |\n| Luxury Villa | 3,500 | 4,500 | 5,500 |\n\n*(AED/m²)*\n\n💡 *Configure AI key for detailed BOQ analysis*`;
    }
    return isAr
      ? `💰 **تكاليف البناء في رأس الخيمة:**\n\n| البند | السعر (درهم/وحدة) |\n|------|------------------|\n| خرسانة C25 | 280/م³ |\n| خرسانة C30 | 320/م³ |\n| حديد 460B | 3,100/طن |\n| بلوك 200mm | 55/م² |\n| بلاط سيراميك | 45/م² |\n\n💡 *حدد مشروع معين لحسابات أدق*`
      : `💰 **Construction Costs in RAK:**\n\n| Item | Price (AED/unit) |\n|------|-----------------|\n| Concrete C25 | 280/m³ |\n| Concrete C30 | 320/m³ |\n| Steel 460B | 3,100/ton |\n| Blockwork 200mm | 55/m² |\n| Ceramic Tiles | 45/m² |\n\n💡 *Specify a project for accurate calculations*`;
  }

  // Engineering-specific demo responses — structural
  if (/structural|إنشائي|خرسانة|حديد|أساس|عمود|كمرة|بلاطة|concrete|steel|foundation|rebar|سقف/.test(lower)) {
    return isAr
      ? `🏗️ **مواصفات إنشائية - الإمارات:**\n\n| البند | المواصفة |\n|------|----------|\n| خرسانة هيكلي | \`C25/30\` كحد أدنى |\n| خرسانة أعمدة | \`C30/37\` |\n| حديد تسليح | \`Grade 460B\` |\n| غطاء خرسانة (خارجي) | \`40mm\` |\n| غطاء خرسانة (سواحل) | \`50-65mm\` |\n| غطاء أساسات | \`50-75mm\` |\n| سمك بلاطة | \`المجوز/30\` (بسيط) |\n| طول ربط | \`40×القطر\` (شد) |\n\n⚠️ *هذه مواصفات تقديبية - راجع مهندس مصنف*\n\n💡 *قم بتهيئة مفتاح AI لحسابات تفصيلية*`
      : `🏗️ **Structural Specs - UAE:**\n\n| Item | Specification |\n|------|-------------|\n| Structural Concrete | \`C25/30\` minimum |\n| Column Concrete | \`C30/37\` |\n| Rebar Steel | \`Grade 460B\` |\n| Cover (exterior) | \`40mm\` |\n| Cover (coastal) | \`50-65mm\` |\n| Cover (foundations) | \`50-75mm\` |\n| Slab thickness | \`Span/30\` (simple) |\n| Lap length | \`40×dia\` (tension) |\n\n⚠️ *These are preliminary specs - consult a licensed engineer*\n\n💡 *Configure AI key for detailed calculations*`;
  }

  // Engineering-specific demo responses — MEP
  if (/mep|كهرباء|تكييف|سباكة|HVAC|electrical|plumbing|fire fighting|إطفاء|ميكانيكي/.test(lower)) {
    return isAr
      ? `⚡ **مواصفات MEP - الإمارات:**\n\n| البند | المواصفة |\n|------|----------|\n| الجهد الكهربائي | \`400V\` ثلاثي / \`230V\` أحادي |\n| التردد | \`50Hz\` |\n| تكييف (سبليت) | 2,200-4,000 درهم/طن |\n| تكييف (مركزي) | 3,500-6,000 درهم/طن |\n| نقطة كهربائية | 100-250 درهم |\n| نقطة سباكة | 150-350 درهم |\n| مكافحة حريق | NFPA 13,14,20,72,101 |\n\n💡 *قم بتهيئة مفتاح AI لتحليل MEP تفصيلي*`
      : `⚡ **MEP Specs - UAE:**\n\n| Item | Specification |\n|------|-------------|\n| Voltage | \`400V\` 3-phase / \`230V\` single |\n| Frequency | \`50Hz\` |\n| HVAC (split) | 2,200-4,000 AED/ton |\n| HVAC (central) | 3,500-6,000 AED/ton |\n| Electrical point | 100-250 AED |\n| Plumbing point | 150-350 AED |\n| Fire fighting | NFPA 13,14,20,72,101 |\n\n💡 *Configure AI key for detailed MEP analysis*`;
  }

  // Engineering-specific demo responses — regulation/permits
  if (/بلدية|دفاع مدني|ترخيص|تصريح|municipality|permit|code|FEWA|DEWA|ADDC|كود|مواصفات|regulation/.test(lower)) {
    return isAr
      ? `🏛️ **الموافقات الحكومية - الإمارات:**\n\n| الجهة | المدة التقريبية |\n|------|---------------|\n| بلدية رأس الخيمة | 2-4 أسابيع |\n| الدفاع المدني | 1-3 أسابيع |\n| FEWA | 1-2 أسابيع |\n\n**وثائق مطلوبة لترخيص البناء:**\n1. مخطط الموقع\n2. مخططات إنشائية\n3. مخططات ميكانيكية وكهربائية\n4. مخططات معمارية\n5. تقرير التربة\n6. موافقة الدفاع المدني\n7. موافقة الهيئة (FEWA)\n\n💡 *قم بتهيئة مفتاح AI لإرشادات تفصيلية*`
      : `🏛️ **Government Approvals - UAE:**\n\n| Authority | Typical Timeline |\n|-----------|-----------------|\n| RAK Municipality | 2-4 weeks |\n| Civil Defense | 1-3 weeks |\n| FEWA | 1-2 weeks |\n\n**Required docs for building permit:**\n1. Site plan\n2. Structural drawings\n3. MEP drawings\n4. Architectural drawings\n5. Soil report\n6. Civil Defense approval\n7. FEWA approval\n\n💡 *Configure AI key for detailed guidance*`;
  }

  // Dashboard/overview
  if (/dashboard|overview|ملخص|لوحة|إحصائ/.test(lower)) {
    const s = contextData.dashboardStats as Record<string, number> | undefined;
    if (s) {
      return isAr
        ? `📊 **ملخص النظام:**\n\n• إجمالي المشاريع: ${s.totalProjects || 0}\n• النشطة: ${s.activeProjects || 0}\n• المكتملة: ${s.completedProjects || 0}\n• المتأخرة: ${s.delayedProjects || 0}\n• المهام: ${s.totalTasks || 0}\n• العملاء: ${s.totalClients || 0}\n\n💡 *اسألني عن أي مشروع أو مهمة أو مواصفات هندسية*`
        : `📊 **System Overview:**\n\n• Total Projects: ${s.totalProjects || 0}\n• Active: ${s.activeProjects || 0}\n• Completed: ${s.completedProjects || 0}\n• Delayed: ${s.delayedProjects || 0}\n• Tasks: ${s.totalTasks || 0}\n• Clients: ${s.totalClients || 0}\n\n💡 *Ask about any project, task, or engineering specification*`;
    }
  }

  if (/project|مشروع|مشاريع/.test(lower)) {
    return isAr
      ? '🏗️ **المشاريع:** يمكنني مساعدتك في تتبع المشاريع والمراحل. حدد مشروع معين للتفاصيل.'
      : '🏗️ **Projects:** I can help track projects and stages. Specify a project for details.';
  }
  if (/task|مهم|مهام/.test(lower)) {
    return isAr
      ? '📋 **المهام:** يمكنني مساعدتك في تتبع المهام المتأخرة وتوزيعها. حدد مشروع أو أولوية.'
      : '📋 **Tasks:** I can help track overdue tasks and assignments. Specify a project or priority.';
  }
  if (/invoice|budget|financial|فاتور|ميزاني/.test(lower)) {
    return isAr
      ? '💰 **المالية:** يمكنني مراجعة الفواتير والميزانيات. حدد مشروع أو فترة زمنية.'
      : '💰 **Financial:** I can review invoices and budgets. Specify a project or period.';
  }
  if (/client|عميل|عملاء/.test(lower)) {
    return isAr
      ? '👥 **العملاء:** يمكنني عرض بيانات العملاء ومشاريعهم. حدد عميل للتفاصيل.'
      : '👥 **Clients:** I can show client data and their projects. Specify a client for details.';
  }
  if (/hello|hi|مرحب|أهلا|السلام/.test(lower)) {
    return isAr
      ? '👋 **مرحباً!** أنا "بلو" المساعد الذكي المتخصص في الهندسة المدنية والإنشائية. اسألني عن: المشاريع، المهام، الفواتير، المواصفات الإنشائية، تكاليف البناء، الموافقات الحكومية.'
      : '👋 **Hello!** I\'m "Blue", the engineering AI assistant specialized in UAE civil and structural engineering. Ask me about: projects, tasks, invoices, structural specs, construction costs, government approvals.';
  }
  if (/help|مساعد|ماذا تستطيع/.test(lower)) {
    return isAr
      ? '🤖 **الأوامر المتاحة:**\n• "ملخص" — ملخص النظام\n• "مشاريع" — حالة المشاريع\n• "مهام" — تتبع المهام\n• "فواتير" — الفواتير\n• "عملاء" — بيانات العملاء\n• "تكلفة بناء" — أسعار البناء في رأس الخيمة\n• "مواصفات إنشائية" — أكواد الخرسانة والحديد\n• "موافقات" — إجراءات البلدية والدفاع المدني\n• "مواصفات MEP" — كهرباء وتكييف وسباكة\n\n💡 *أضف API Key في .env لإجابات أذكى*'
      : '🤖 **Available commands:**\n• "dashboard" — system overview\n• "projects" — project status\n• "tasks" — task tracking\n• "invoices" — financial data\n• "clients" — client info\n• "construction cost" — RAK building costs\n• "structural specs" — concrete & steel codes\n• "permits" — municipality & civil defense procedures\n• "MEP specs" — electrical, HVAC, plumbing\n\n💡 *Add API Key in .env for smarter responses*';
  }

  return isAr
    ? 'أنا "بلو" المساعد الذكي المتخصص في الهندسة المدنية والإنشائية في الإمارات. أنا حالياً في وضع العرض التجريبي — يمكنني مساعدتك بالمواصفات الهندسية وتكاليف البناء وإجراءات الموافقات. للحصول على إجابات ذكية متقدمة، يجب تهيئة مفتاح AI في إعدادات النظام.'
    : 'I\'m "Blue", the engineering AI assistant specialized in UAE civil & structural engineering. I\'m currently in demo mode — I can help with engineering specs, construction costs, and approval procedures. For advanced AI responses, an AI key must be configured in the system settings.';
}

// ============================================
// SSE Streaming Helpers
// ============================================

const sseEncoder = new TextEncoder();

export function sseEvent(data: unknown): Uint8Array {
  return sseEncoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Simulate streaming by chunking a complete response string.
 * Splits into small token-like chunks and yields them with realistic delays.
 */
async function* simulateStream(fullText: string): AsyncGenerator<string, void, unknown> {
  // Split the text into chunks of 2-8 characters for realistic token streaming
  let i = 0;
  while (i < fullText.length) {
    // Vary chunk size to simulate real token boundaries
    const chunkSize = Math.min(Math.floor(Math.random() * 6) + 2, fullText.length - i);
    const chunk = fullText.slice(i, i + chunkSize);
    yield chunk;
    i += chunkSize;
    // Small delay between chunks (10-30ms) for visual streaming effect
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 20));
  }
}

/**
 * Stream a full (already-collected) text response through SSE,
 * chunking it to simulate token-by-token delivery.
 */
export async function streamFullText(
  controller: ReadableStreamDefaultController,
  fullText: string,
): Promise<void> {
  for await (const chunk of simulateStream(fullText)) {
    controller.enqueue(sseEvent({ type: 'token', content: chunk }));
  }
}

/**
 * Stream from an async generator (real provider streaming) through SSE.
 */
export async function streamFromGenerator(
  controller: ReadableStreamDefaultController,
  generator: AsyncGenerator<string, void, unknown>,
): Promise<string> {
  let fullText = '';
  for await (const token of generator) {
    fullText += token;
    controller.enqueue(sseEvent({ type: 'token', content: token }));
  }
  return fullText;
}

/**
 * @openapi
 * /api/ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: AI chat assistant
 *     description: Send a message to the AI assistant. The system automatically detects topics and fetches relevant context data (projects, tasks, invoices, etc.) based on user permissions. Supports conversation persistence and project-scoped queries. Requires REPORTS_READ permission.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 description: User message to the AI assistant
 *                 example: "What is the status of the Al Hamra villa project?"
 *               conversationId:
 *                 type: string
 *                 description: Existing conversation ID for context continuity. New conversation created if omitted.
 *               language:
 *                 type: string
 *                 enum: [ar, en]
 *                 default: en
 *                 description: Response language
 *               projectId:
 *                 type: string
 *                 description: Project ID to scope context data. AI will include project-specific information.
 *               modelId:
 *                 type: string
 *                 description: AI model identifier (defaults to zai-default)
 *               model:
 *                 type: string
 *                 description: Alternative model identifier
 *     responses:
 *       200:
 *         description: AI response with conversation metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: AI-generated response text (Markdown formatted)
 *                 conversationId:
 *                   type: string
 *                   description: Conversation ID for subsequent messages
 *                 messageId:
 *                   type: string
 *                   description: ID of the saved AI message
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Missing REPORTS_READ permission
 *       429:
 *         description: Rate limit exceeded (AI-specific limits apply)
 *       500:
 *         description: AI service unavailable or internal error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */