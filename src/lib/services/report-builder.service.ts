/**
 * Report Builder Service
 * خدمة منشئ التقارير المخصصة
 *
 * Core service for building custom reports from dynamic definitions.
 * Supports multiple data sources, aggregations, filtering, grouping, sorting,
 * and output formatting (JSON, CSV, PDF).
 */

import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// ============================================
// Type Definitions
// ============================================

export type DataSourceName =
  | 'projects'
  | 'invoices'
  | 'tasks'
  | 'clients'
  | 'employees'
  | 'payments'
  | 'contracts'
  | 'timesheets'
  | 'expenses'
  | 'commissions';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'between'
  | 'isNull'
  | 'isNotNull';

export type ChartType = 'bar' | 'line' | 'pie' | 'table';

export type OutputFormat = 'json' | 'csv' | 'pdf';

export type SortOrder = 'asc' | 'desc';

export interface ReportField {
  key: string;
  label: string;
  aggregation: AggregationType;
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
  value2?: unknown; // For 'between' operator
}

export interface ReportDefinition {
  id?: string;
  name: string;
  nameAr?: string;
  description?: string;
  dataSource: DataSourceName;
  fields: ReportField[];
  filters: ReportFilter[];
  groupBy?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  chartType?: ChartType;
  format?: OutputFormat;
}

export interface ReportResult {
  columns: Array<{ key: string; label: string }>;
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
}

// ============================================
// Data Source Field Metadata
// ============================================

interface FieldMeta {
  key: string;
  labelEn: string;
  labelAr: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  aggregatable: boolean;
}

interface DataSourceMeta {
  key: DataSourceName;
  labelEn: string;
  labelAr: string;
  fields: FieldMeta[];
}

const DATA_SOURCE_METADATA: DataSourceMeta[] = [
  {
    key: 'projects',
    labelEn: 'Projects',
    labelAr: 'المشاريع',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'number', labelEn: 'Number', labelAr: 'الرقم', type: 'string', aggregatable: false },
      { key: 'name', labelEn: 'Name', labelAr: 'الاسم', type: 'string', aggregatable: false },
      { key: 'nameEn', labelEn: 'Name (English)', labelAr: 'الاسم (إنجليزي)', type: 'string', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'type', labelEn: 'Type', labelAr: 'النوع', type: 'string', aggregatable: false },
      { key: 'progress', labelEn: 'Progress', labelAr: 'التقدم', type: 'number', aggregatable: true },
      { key: 'budget', labelEn: 'Budget', labelAr: 'الميزانية', type: 'number', aggregatable: true },
      { key: 'contractValue', labelEn: 'Contract Value', labelAr: 'قيمة العقد', type: 'number', aggregatable: true },
      { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البدء', type: 'date', aggregatable: false },
      { key: 'endDate', labelEn: 'End Date', labelAr: 'تاريخ الانتهاء', type: 'date', aggregatable: false },
      { key: 'expectedDuration', labelEn: 'Expected Duration (days)', labelAr: 'المدة المتوقعة (أيام)', type: 'number', aggregatable: true },
      { key: 'location', labelEn: 'Location', labelAr: 'الموقع', type: 'string', aggregatable: false },
      { key: 'currency', labelEn: 'Currency', labelAr: 'العملة', type: 'string', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'invoices',
    labelEn: 'Invoices',
    labelAr: 'الفواتير',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'number', labelEn: 'Number', labelAr: 'الرقم', type: 'string', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'subtotal', labelEn: 'Subtotal', labelAr: 'المجموع الفرعي', type: 'number', aggregatable: true },
      { key: 'tax', labelEn: 'Tax', labelAr: 'الضريبة', type: 'number', aggregatable: true },
      { key: 'total', labelEn: 'Total', labelAr: 'الإجمالي', type: 'number', aggregatable: true },
      { key: 'paidAmount', labelEn: 'Paid Amount', labelAr: 'المبلغ المدفوع', type: 'number', aggregatable: true },
      { key: 'remaining', labelEn: 'Remaining', labelAr: 'المتبقي', type: 'number', aggregatable: true },
      { key: 'issueDate', labelEn: 'Issue Date', labelAr: 'تاريخ الإصدار', type: 'date', aggregatable: false },
      { key: 'dueDate', labelEn: 'Due Date', labelAr: 'تاريخ الاستحقاق', type: 'date', aggregatable: false },
      { key: 'currency', labelEn: 'Currency', labelAr: 'العملة', type: 'string', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'tasks',
    labelEn: 'Tasks',
    labelAr: 'المهام',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'title', labelEn: 'Title', labelAr: 'العنوان', type: 'string', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'priority', labelEn: 'Priority', labelAr: 'الأولوية', type: 'string', aggregatable: false },
      { key: 'progress', labelEn: 'Progress', labelAr: 'التقدم', type: 'number', aggregatable: true },
      { key: 'estimatedHours', labelEn: 'Estimated Hours', labelAr: 'الساعات المقدرة', type: 'number', aggregatable: true },
      { key: 'actualHours', labelEn: 'Actual Hours', labelAr: 'الساعات الفعلية', type: 'number', aggregatable: true },
      { key: 'slaDays', labelEn: 'SLA Days', labelAr: 'أيام SLA', type: 'number', aggregatable: true },
      { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البدء', type: 'date', aggregatable: false },
      { key: 'dueDate', labelEn: 'Due Date', labelAr: 'تاريخ الاستحقاق', type: 'date', aggregatable: false },
      { key: 'taskType', labelEn: 'Task Type', labelAr: 'نوع المهمة', type: 'string', aggregatable: false },
      { key: 'isMilestone', labelEn: 'Is Milestone', labelAr: 'هل هو معلم', type: 'boolean', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'clients',
    labelEn: 'Clients',
    labelAr: 'العملاء',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'name', labelEn: 'Name', labelAr: 'الاسم', type: 'string', aggregatable: false },
      { key: 'nameEn', labelEn: 'Name (English)', labelAr: 'الاسم (إنجليزي)', type: 'string', aggregatable: false },
      { key: 'clientType', labelEn: 'Client Type', labelAr: 'نوع العميل', type: 'string', aggregatable: false },
      { key: 'email', labelEn: 'Email', labelAr: 'البريد الإلكتروني', type: 'string', aggregatable: false },
      { key: 'phone', labelEn: 'Phone', labelAr: 'الهاتف', type: 'string', aggregatable: false },
      { key: 'creditLimit', labelEn: 'Credit Limit', labelAr: 'حد الائتمان', type: 'number', aggregatable: true },
      { key: 'creditUsed', labelEn: 'Credit Used', labelAr: 'الائتمان المستخدم', type: 'number', aggregatable: true },
      { key: 'isActive', labelEn: 'Active', labelAr: 'نشط', type: 'boolean', aggregatable: false },
      { key: 'referralSource', labelEn: 'Referral Source', labelAr: 'مصدر الإحالة', type: 'string', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'employees',
    labelEn: 'Employees',
    labelAr: 'الموظفين',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'department', labelEn: 'Department', labelAr: 'القسم', type: 'string', aggregatable: false },
      { key: 'position', labelEn: 'Position', labelAr: 'المنصب', type: 'string', aggregatable: false },
      { key: 'salary', labelEn: 'Salary', labelAr: 'الراتب', type: 'number', aggregatable: true },
      { key: 'employmentStatus', labelEn: 'Employment Status', labelAr: 'حالة التوظيف', type: 'string', aggregatable: false },
      { key: 'hireDate', labelEn: 'Hire Date', labelAr: 'تاريخ التعيين', type: 'date', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'payments',
    labelEn: 'Payments',
    labelAr: 'المدفوعات',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'voucherNumber', labelEn: 'Voucher Number', labelAr: 'رقم السند', type: 'string', aggregatable: false },
      { key: 'amount', labelEn: 'Amount', labelAr: 'المبلغ', type: 'number', aggregatable: true },
      { key: 'payMethod', labelEn: 'Payment Method', labelAr: 'طريقة الدفع', type: 'string', aggregatable: false },
      { key: 'beneficiary', labelEn: 'Beneficiary', labelAr: 'المستفيد', type: 'string', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'referenceNumber', labelEn: 'Reference Number', labelAr: 'الرقم المرجعي', type: 'string', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'contracts',
    labelEn: 'Contracts',
    labelAr: 'العقود',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'number', labelEn: 'Number', labelAr: 'الرقم', type: 'string', aggregatable: false },
      { key: 'title', labelEn: 'Title', labelAr: 'العنوان', type: 'string', aggregatable: false },
      { key: 'value', labelEn: 'Value', labelAr: 'القيمة', type: 'number', aggregatable: true },
      { key: 'type', labelEn: 'Type', labelAr: 'النوع', type: 'string', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'startDate', labelEn: 'Start Date', labelAr: 'تاريخ البدء', type: 'date', aggregatable: false },
      { key: 'endDate', labelEn: 'End Date', labelAr: 'تاريخ الانتهاء', type: 'date', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'timesheets',
    labelEn: 'Timesheets',
    labelAr: 'جداول الدوام',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'weekStart', labelEn: 'Week Start', labelAr: 'بداية الأسبوع', type: 'date', aggregatable: false },
      { key: 'weekEnd', labelEn: 'Week End', labelAr: 'نهاية الأسبوع', type: 'date', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'totalHours', labelEn: 'Total Hours', labelAr: 'إجمالي الساعات', type: 'number', aggregatable: true },
      { key: 'notes', labelEn: 'Notes', labelAr: 'ملاحظات', type: 'string', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'expenses',
    labelEn: 'Expenses',
    labelAr: 'المصروفات',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'amount', labelEn: 'Amount', labelAr: 'المبلغ', type: 'number', aggregatable: true },
      { key: 'beneficiary', labelEn: 'Beneficiary', labelAr: 'المستفيد', type: 'string', aggregatable: false },
      { key: 'payMethod', labelEn: 'Payment Method', labelAr: 'طريقة الدفع', type: 'string', aggregatable: false },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'description', labelEn: 'Description', labelAr: 'الوصف', type: 'string', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
  {
    key: 'commissions',
    labelEn: 'Commissions',
    labelAr: 'العمولات',
    fields: [
      { key: 'id', labelEn: 'ID', labelAr: 'المعرف', type: 'string', aggregatable: false },
      { key: 'type', labelEn: 'Type', labelAr: 'النوع', type: 'string', aggregatable: false },
      { key: 'amount', labelEn: 'Amount', labelAr: 'المبلغ', type: 'number', aggregatable: true },
      { key: 'percentage', labelEn: 'Percentage', labelAr: 'النسبة', type: 'number', aggregatable: true },
      { key: 'baseAmount', labelEn: 'Base Amount', labelAr: 'المبلغ الأساسي', type: 'number', aggregatable: true },
      { key: 'status', labelEn: 'Status', labelAr: 'الحالة', type: 'string', aggregatable: false },
      { key: 'currency', labelEn: 'Currency', labelAr: 'العملة', type: 'string', aggregatable: false },
      { key: 'periodStart', labelEn: 'Period Start', labelAr: 'بداية الفترة', type: 'date', aggregatable: false },
      { key: 'periodEnd', labelEn: 'Period End', labelAr: 'نهاية الفترة', type: 'date', aggregatable: false },
      { key: 'createdAt', labelEn: 'Created At', labelAr: 'تاريخ الإنشاء', type: 'date', aggregatable: false },
    ],
  },
];

// ============================================
// Result Caching (5-minute TTL)
// ============================================

interface CachedResult {
  result: ReportResult;
  expiresAt: number;
}

const resultCache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(definition: ReportDefinition, organizationId: string | null): string {
  // Create a deterministic cache key from the definition and org
  const serialized = JSON.stringify({ definition, organizationId });
  return serialized;
}

function getCachedResult(key: string): ReportResult | null {
  const cached = resultCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    resultCache.delete(key);
    return null;
  }
  return cached.result;
}

function setCachedResult(key: string, result: ReportResult): void {
  // Evict expired entries periodically (every 100 writes)
  if (resultCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of resultCache.entries()) {
      if (now > v.expiresAt) resultCache.delete(k);
    }
  }
  resultCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================
// Filter Builder
// ============================================

/**
 * Convert a ReportFilter to a Prisma where clause fragment.
 */
function buildFilterClause(filter: ReportFilter): Record<string, unknown> {
  const { field, operator, value, value2 } = filter;

  switch (operator) {
    case 'eq':
      return { [field]: value };
    case 'neq':
      return { [field]: { not: value } };
    case 'gt':
      return { [field]: { gt: value } };
    case 'gte':
      return { [field]: { gte: value } };
    case 'lt':
      return { [field]: { lt: value } };
    case 'lte':
      return { [field]: { lte: value } };
    case 'contains':
      return { [field]: { contains: value, mode: 'insensitive' } };
    case 'startsWith':
      return { [field]: { startsWith: value } };
    case 'endsWith':
      return { [field]: { endsWith: value } };
    case 'in': {
      const values = Array.isArray(value) ? value : [value];
      return { [field]: { in: values } };
    }
    case 'notIn': {
      const values = Array.isArray(value) ? value : [value];
      return { [field]: { notIn: values } };
    }
    case 'between':
      return { [field]: { gte: value, lte: value2 ?? value } };
    case 'isNull':
      return { [field]: null };
    case 'isNotNull':
      return { [field]: { not: null } };
    default:
      return { [field]: value };
  }
}

/**
 * Build the complete Prisma where clause from filters and org filter.
 * SECURITY:
 * 1. Explicitly ignore/strip any filter attempting to target `organizationId` directly
 * 2. Combine orgWhere and user filters using `AND: [...]` so user filters can never override tenant scoping.
 */
function buildWhereClause(
  filters: ReportFilter[],
  orgWhere: Record<string, unknown>
): Record<string, unknown> {
  const sanitizedFilters = (filters || []).filter(
    (f) => f && f.field && f.field !== 'organizationId' && f.field !== 'organization'
  );

  if (sanitizedFilters.length === 0) {
    return { ...orgWhere };
  }

  const filterClauses = sanitizedFilters.map(buildFilterClause);

  return {
    AND: [
      orgWhere,
      ...filterClauses,
    ],
  };
}

// ============================================
// Aggregation Builder
// ============================================

type PrismaAggregateFunction = '_sum' | '_avg' | '_count' | '_min' | '_max';

/**
 * Get the Prisma aggregate function key from an AggregationType.
 */
function getPrismaAggregateFn(agg: AggregationType): PrismaAggregateFunction {
  switch (agg) {
    case 'sum':
      return '_sum';
    case 'avg':
      return '_avg';
    case 'count':
      return '_count';
    case 'min':
      return '_min';
    case 'max':
      return '_max';
    case 'none':
    default:
      return '_count';
  }
}

// ============================================
// Data Source Accessors
// ============================================

/**
 * Data source model interface — abstracts away Prisma model differences.
 * Uses `unknown` return types since each model returns different shapes.
 */
interface DataSourceModel {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
  aggregate: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  groupBy: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  count: (args: Record<string, unknown>) => Promise<number>;
}

type GroupByFn = (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;

/**
 * Get the Prisma model delegate for a data source name.
 * Returns typed accessor functions for each data source.
 *
 * NOTE: The groupBy method casts return type because Prisma's groupBy
 * has complex overloaded intersection types that cannot be satisfied by
 * dynamically-constructed arguments. The runtime behavior is correct.
 */
function getDataSourceModel(dataSource: DataSourceName): DataSourceModel {
  switch (dataSource) {
    case 'projects':
      return {
        findMany: async (args) => db.project.findMany(args as Prisma.ProjectFindManyArgs),
        aggregate: async (args) => db.project.aggregate(args as Prisma.ProjectAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.project.groupBy as GroupByFn)(args),
        count: async (args) => db.project.count(args as Prisma.ProjectCountArgs),
      };
    case 'invoices':
      return {
        findMany: async (args) => db.invoice.findMany(args as Prisma.InvoiceFindManyArgs),
        aggregate: async (args) => db.invoice.aggregate(args as Prisma.InvoiceAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.invoice.groupBy as GroupByFn)(args),
        count: async (args) => db.invoice.count(args as Prisma.InvoiceCountArgs),
      };
    case 'tasks':
      return {
        findMany: async (args) => db.task.findMany(args as Prisma.TaskFindManyArgs),
        aggregate: async (args) => db.task.aggregate(args as Prisma.TaskAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.task.groupBy as GroupByFn)(args),
        count: async (args) => db.task.count(args as Prisma.TaskCountArgs),
      };
    case 'clients':
      return {
        findMany: async (args) => db.client.findMany(args as Prisma.ClientFindManyArgs),
        aggregate: async (args) => db.client.aggregate(args as Prisma.ClientAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.client.groupBy as GroupByFn)(args),
        count: async (args) => db.client.count(args as Prisma.ClientCountArgs),
      };
    case 'employees':
      return {
        findMany: async (args) => db.employee.findMany(args as Prisma.EmployeeFindManyArgs),
        aggregate: async (args) => db.employee.aggregate(args as Prisma.EmployeeAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.employee.groupBy as GroupByFn)(args),
        count: async (args) => db.employee.count(args as Prisma.EmployeeCountArgs),
      };
    case 'payments':
      return {
        findMany: async (args) => db.payment.findMany(args as Prisma.PaymentFindManyArgs),
        aggregate: async (args) => db.payment.aggregate(args as Prisma.PaymentAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.payment.groupBy as GroupByFn)(args),
        count: async (args) => db.payment.count(args as Prisma.PaymentCountArgs),
      };
    case 'contracts':
      return {
        findMany: async (args) => db.contract.findMany(args as Prisma.ContractFindManyArgs),
        aggregate: async (args) => db.contract.aggregate(args as Prisma.ContractAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.contract.groupBy as GroupByFn)(args),
        count: async (args) => db.contract.count(args as Prisma.ContractCountArgs),
      };
    case 'timesheets':
      return {
        findMany: async (args) => db.timesheet.findMany(args as Prisma.TimesheetFindManyArgs),
        aggregate: async (args) => db.timesheet.aggregate(args as Prisma.TimesheetAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.timesheet.groupBy as GroupByFn)(args),
        count: async (args) => db.timesheet.count(args as Prisma.TimesheetCountArgs),
      };
    case 'expenses':
      // Expenses use the Payment model (all outgoing payments represent expenses)
      return {
        findMany: async (args) => db.payment.findMany(args as Prisma.PaymentFindManyArgs),
        aggregate: async (args) => db.payment.aggregate(args as Prisma.PaymentAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.payment.groupBy as GroupByFn)(args),
        count: async (args) => db.payment.count(args as Prisma.PaymentCountArgs),
      };
    case 'commissions':
      return {
        findMany: async (args) => db.commission.findMany(args as Prisma.CommissionFindManyArgs),
        aggregate: async (args) => db.commission.aggregate(args as Prisma.CommissionAggregateArgs) as Promise<Record<string, unknown>>,
        groupBy: async (args) => (db.commission.groupBy as GroupByFn)(args),
        count: async (args) => db.commission.count(args as Prisma.CommissionCountArgs),
      };
    default:
      throw new Error(`Unknown data source: ${dataSource}`);
  }
}

// ============================================
// Core Execution Logic
// ============================================

/**
 * Execute a report definition and return results.
 * This is the main entry point for report execution.
 */
export async function executeReport(
  definition: ReportDefinition,
  organizationId: string | null
): Promise<ReportResult> {
  const startTime = Date.now();

  // Check cache first
  const cacheKey = getCacheKey(definition, organizationId);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    log.service('ReportBuilder', 'Cache hit', { dataSource: definition.dataSource });
    return { ...cached, executionTimeMs: Date.now() - startTime };
  }

  // Build org filter
  const orgWhere: Record<string, unknown> = organizationId
    ? { organizationId }
    : (process.env.MULTI_TENANT === 'true' ? { organizationId: '__DENIED__' } : {});

  // For expenses, add additional filter
  if (definition.dataSource === 'expenses') {
    // Expenses are payments - no special type filter needed, they all represent outgoing money
  }

  const where = buildWhereClause(definition.filters, orgWhere);
  const model = getDataSourceModel(definition.dataSource);

  // Check if we need aggregation with grouping
  const hasAggregation = definition.fields.some((f) => f.aggregation !== 'none');

  let rows: Record<string, unknown>[];
  let columns: Array<{ key: string; label: string }>;

  if (definition.groupBy && hasAggregation) {
    // GroupBy + Aggregation path
    const result = await executeGroupedQuery(model, definition, where);
    rows = result.rows;
    columns = result.columns;
  } else if (hasAggregation) {
    // Aggregation only (no grouping) — single summary row
    const result = await executeAggregateQuery(model, definition, where);
    rows = result.rows;
    columns = result.columns;
  } else {
    // Simple findMany — no aggregation
    const result = await executeSimpleQuery(model, definition, where);
    rows = result.rows;
    columns = result.columns;
  }

  const result: ReportResult = {
    columns,
    rows,
    totalRows: rows.length,
    executionTimeMs: Date.now() - startTime,
  };

  // Cache the result
  setCachedResult(cacheKey, result);

  log.service('ReportBuilder', 'Executed report', {
    dataSource: definition.dataSource,
    totalRows: result.totalRows,
    executionTimeMs: result.executionTimeMs,
  });

  return result;
}

/**
 * Execute a simple findMany query (no aggregation).
 */
async function executeSimpleQuery(
  model: DataSourceModel,
  definition: ReportDefinition,
  where: Record<string, unknown>
): Promise<{ rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string }> }> {
  const selectFields = definition.fields.map((f) => f.key);

  // Build select object — only include requested fields
  const select: Record<string, boolean> = {};
  for (const key of selectFields) {
    select[key] = true;
  }

  const orderBy = definition.sortBy
    ? { [definition.sortBy]: definition.sortOrder || 'desc' }
    : { createdAt: 'desc' as const };

  const rows = await model.findMany({
    where,
    select,
    orderBy,
  }) as Record<string, unknown>[];

  // Convert Decimal values to numbers for serialization
  const serializedRows = rows.map((row) => serializeRow(row));

  const columns = definition.fields.map((f) => ({ key: f.key, label: f.label }));

  return { rows: serializedRows, columns };
}

/**
 * Execute an aggregate query (no grouping — returns single summary row).
 */
async function executeAggregateQuery(
  model: DataSourceModel,
  definition: ReportDefinition,
  where: Record<string, unknown>
): Promise<{ rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string }> }> {
  // Build aggregate _sum, _avg, etc. from fields
  const aggregateFields: Record<string, boolean> = {};
  const columns: Array<{ key: string; label: string }> = [];

  for (const field of definition.fields) {
    if (field.aggregation === 'none') continue;
    if (field.aggregation === 'count') {
      // _count is special — doesn't need a field name
      columns.push({ key: `_count_${field.key}`, label: field.label });
    } else {
      aggregateFields[field.key] = true;
      columns.push({ key: `${field.aggregation}_${field.key}`, label: field.label });
    }
  }

  // Group aggregate functions
  const aggregateByFn: Record<string, Record<string, boolean>> = {};
  for (const field of definition.fields) {
    if (field.aggregation === 'none' || field.aggregation === 'count') continue;
    const fnKey = getPrismaAggregateFn(field.aggregation);
    if (!aggregateByFn[fnKey]) aggregateByFn[fnKey] = {};
    aggregateByFn[fnKey][field.key] = true;
  }

  const aggregateArgs: Record<string, unknown> = { where };

  for (const [fnKey, fields] of Object.entries(aggregateByFn)) {
    aggregateArgs[fnKey] = fields;
  }

  // Add _count if any count aggregation
  const countFields = definition.fields.filter((f) => f.aggregation === 'count');
  if (countFields.length > 0) {
    aggregateArgs._count = true;
  }

  const aggregateResult = await model.aggregate(aggregateArgs) as Record<string, unknown>;

  // Flatten aggregate result into a single row
  const row: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (field.aggregation === 'none') continue;
    if (field.aggregation === 'count') {
      row[`_count_${field.key}`] = (aggregateResult._count as number) ?? 0;
    } else {
      const fnKey = getPrismaAggregateFn(field.aggregation);
      const fnResult = aggregateResult[fnKey] as Record<string, unknown> | null;
      const rawValue = fnResult?.[field.key];
      row[`${field.aggregation}_${field.key}`] = rawValue != null ? Number(rawValue) : null;
    }
  }

  return { rows: [row], columns };
}

/**
 * Execute a grouped query (groupBy + aggregation).
 */
async function executeGroupedQuery(
  model: DataSourceModel,
  definition: ReportDefinition,
  where: Record<string, unknown>
): Promise<{ rows: Record<string, unknown>[]; columns: Array<{ key: string; label: string }> }> {
  const groupByField = definition.groupBy!;

  // Build aggregation for grouped query
  const aggregateFields: Record<string, Record<string, boolean>> = {};
  const columns: Array<{ key: string; label: string }> = [
    { key: groupByField, label: groupByField },
  ];

  for (const field of definition.fields) {
    if (field.aggregation === 'none') continue;
    if (field.aggregation === 'count') {
      columns.push({ key: `_count`, label: field.label });
      continue;
    }
    const fnKey = getPrismaAggregateFn(field.aggregation);
    if (!aggregateFields[fnKey]) aggregateFields[fnKey] = {};
    aggregateFields[fnKey][field.key] = true;
    columns.push({ key: `${field.aggregation}_${field.key}`, label: field.label });
  }

  const groupByArgs: Record<string, unknown> = {
    by: [groupByField],
    where,
    _count: definition.fields.some((f) => f.aggregation === 'count'),
    ...aggregateFields,
    orderBy: definition.sortBy
      ? { [definition.sortBy]: definition.sortOrder || 'desc' }
      : undefined,
  };

  const groupedResults = await model.groupBy(groupByArgs) as Array<Record<string, unknown>>;

  // Serialize and flatten
  const rows = groupedResults.map((group) => {
    const row: Record<string, unknown> = {
      [groupByField]: group[groupByField],
    };
    for (const field of definition.fields) {
      if (field.aggregation === 'none') continue;
      if (field.aggregation === 'count') {
        row['_count'] = Number(group._count ?? 0);
      } else {
        const fnKey = getPrismaAggregateFn(field.aggregation);
        const fnResult = group[fnKey] as Record<string, unknown> | null;
        const rawValue = fnResult?.[field.key];
        row[`${field.aggregation}_${field.key}`] = rawValue != null ? Number(rawValue) : null;
      }
    }
    return row;
  });

  return { rows, columns };
}

// ============================================
// Serialization Helper
// ============================================

/**
 * Convert Prisma Decimal, Date, and other special types to JSON-safe values.
 */
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object' && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
      // Prisma Decimal
      result[key] = Number(value);
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'bigint') {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================
// CSV Formatting
// ============================================

/**
 * Convert report results to CSV string with UTF-8 BOM for Arabic support.
 */
export function formatAsCSV(result: ReportResult): string {
  const { columns, rows } = result;
  if (rows.length === 0) return '';

  // Escape CSV cells
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escape(c.label)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((col) => escape(row[col.key])).join(',')
  );

  // BOM for proper Arabic display in Excel
  const bom = '\uFEFF';
  return bom + [header, ...dataRows].join('\r\n');
}

// ============================================
// PDF Formatting (delegates to existing PDF utilities)
// ============================================

/**
 * Format report results as PDF buffer.
 * Uses the existing PDF generation utilities for consistency.
 */
export async function formatAsPDF(
  result: ReportResult,
  title: string,
  language: 'ar' | 'en' = 'en',
  currency: string = 'AED',
  organizationId?: string | null
): Promise<Buffer> {
  // Dynamic import to avoid bundling jsPDF in client
  const { generateGenericReportPDF } = await import('@/lib/pdf/generic-report-pdf');
  return generateGenericReportPDF({
    title,
    columns: result.columns,
    rows: result.rows,
    language,
    currency,
    // SECURITY: scope the printed company identity to the caller's organization
    organizationId: organizationId || undefined,
  });
}

// ============================================
// Excel Formatting (delegates to ExcelJS)
// ============================================

/**
 * Format report results as Excel (XLSX) buffer.
 * Uses ExcelJS for professional spreadsheet generation with Arabic support.
 */
export async function formatAsExcel(
  result: ReportResult,
  title: string,
  language: 'ar' | 'en' = 'ar'
): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const isRTL = language === 'ar';

  const sheetName = isRTL ? 'تقرير' : 'Report';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: isRTL ? [{ rightToLeft: true }] : undefined,
  });

  // Define columns from report result
  worksheet.columns = result.columns.map((col) => ({
    key: col.key,
    header: col.label,
    width: 20,
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  for (let col = 1; col <= result.columns.length; col++) {
    const cell = headerRow.getCell(col);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF14B8A6' }, // Teal matching BluePrint branding
    };
    cell.alignment = {
      horizontal: isRTL ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF0D9488' } },
    };
  }
  headerRow.height = 25;

  // Add data rows
  for (const row of result.rows) {
    const rowData: Record<string, unknown> = {};
    for (const col of result.columns) {
      const val = row[col.key];
      if (val === null || val === undefined) {
        rowData[col.key] = '';
      } else if (typeof val === 'number') {
        rowData[col.key] = val;
      } else {
        rowData[col.key] = String(val);
      }
    }
    worksheet.addRow(rowData);
  }

  // Style data rows (alternating colors)
  for (let i = 2; i <= result.rows.length + 1; i++) {
    const dataRow = worksheet.getRow(i);
    if (i % 2 === 0) {
      for (let col = 1; col <= result.columns.length; col++) {
        dataRow.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // Light gray alternating
        };
      }
    }
    for (let col = 1; col <= result.columns.length; col++) {
      dataRow.getCell(col).alignment = {
        horizontal: isRTL ? 'right' : 'left',
        vertical: 'middle',
      };
    }
  }

  // Add title row at top (shift everything down by inserting rows)
  worksheet.spliceRows(1, 0, [], []);
  worksheet.mergeCells(1, 1, 1, result.columns.length);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF14B8A6' } };
  titleCell.alignment = { horizontal: isRTL ? 'right' : 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // Add date row
  worksheet.spliceRows(2, 0, [], []);
  worksheet.mergeCells(2, 1, 2, result.columns.length);
  const dateCell = worksheet.getCell('A2');
  dateCell.value = isRTL
    ? `تاريخ: ${new Date().toLocaleDateString('ar-SA')} — إجمالي السجلات: ${result.totalRows}`
    : `Date: ${new Date().toLocaleDateString('en-US')} — Total Records: ${result.totalRows}`;
  dateCell.font = { size: 10, color: { argb: 'FF64748B' } };
  dateCell.alignment = { horizontal: isRTL ? 'right' : 'left' };
  worksheet.getRow(2).height = 20;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ============================================
// Public API
// ============================================

/**
 * Get all available data sources and their field metadata.
 */
export function getDataSourceMetadata(): DataSourceMeta[] {
  return DATA_SOURCE_METADATA;
}

/**
 * Get metadata for a specific data source.
 */
export function getDataSourceFields(dataSource: DataSourceName): FieldMeta[] {
  const meta = DATA_SOURCE_METADATA.find((ds) => ds.key === dataSource);
  return meta?.fields ?? [];
}

/**
 * Get available filter operators with labels.
 */
export function getFilterOperators(): Array<{
  value: FilterOperator;
  labelEn: string;
  labelAr: string;
}> {
  return [
    { value: 'eq', labelEn: 'Equals', labelAr: 'يساوي' },
    { value: 'neq', labelEn: 'Not Equals', labelAr: 'لا يساوي' },
    { value: 'gt', labelEn: 'Greater Than', labelAr: 'أكبر من' },
    { value: 'gte', labelEn: 'Greater Than or Equal', labelAr: 'أكبر من أو يساوي' },
    { value: 'lt', labelEn: 'Less Than', labelAr: 'أقل من' },
    { value: 'lte', labelEn: 'Less Than or Equal', labelAr: 'أقل من أو يساوي' },
    { value: 'contains', labelEn: 'Contains', labelAr: 'يحتوي على' },
    { value: 'startsWith', labelEn: 'Starts With', labelAr: 'يبدأ بـ' },
    { value: 'endsWith', labelEn: 'Ends With', labelAr: 'ينتهي بـ' },
    { value: 'in', labelEn: 'In', labelAr: 'ضمن' },
    { value: 'notIn', labelEn: 'Not In', labelAr: 'ليس ضمن' },
    { value: 'between', labelEn: 'Between', labelAr: 'بين' },
    { value: 'isNull', labelEn: 'Is Empty', labelAr: 'فارغ' },
    { value: 'isNotNull', labelEn: 'Is Not Empty', labelAr: 'غير فارغ' },
  ];
}

/**
 * Validate a report definition before execution.
 * Returns an array of error messages, or empty array if valid.
 */
export function validateReportDefinition(definition: Partial<ReportDefinition>): string[] {
  const errors: string[] = [];

  if (!definition.dataSource) {
    errors.push('Data source is required');
  } else {
    const validSources = DATA_SOURCE_METADATA.map((ds) => ds.key);
    if (!validSources.includes(definition.dataSource)) {
      errors.push(`Invalid data source: ${definition.dataSource}`);
    }
  }

  if (!definition.fields || definition.fields.length === 0) {
    errors.push('At least one field is required');
  } else {
    // Validate field keys exist for the data source
    if (definition.dataSource) {
      const validFields = getDataSourceFields(definition.dataSource);
      const validKeys = new Set(validFields.map((f) => f.key));
      for (const field of definition.fields) {
        if (!validKeys.has(field.key)) {
          errors.push(`Invalid field key for ${definition.dataSource}: ${field.key}`);
        }
        if (!field.aggregation) {
          errors.push(`Aggregation type is required for field: ${field.key}`);
        }
      }
    }
  }

  // Validate filters
  if (definition.filters) {
    const validFields = definition.dataSource ? getDataSourceFields(definition.dataSource) : [];
    const validKeys = new Set(validFields.map((f) => f.key));

    for (let i = 0; i < definition.filters.length; i++) {
      const filter = definition.filters[i];
      if (!filter.field) {
        errors.push(`Filter ${i + 1}: field is required`);
        continue;
      }

      // SECURITY: Disallow direct targeting of tenant/org fields in custom filters
      if (filter.field === 'organizationId' || filter.field === 'organization') {
        errors.push(`Filter ${i + 1}: field '${filter.field}' is restricted and cannot be filtered`);
        continue;
      }

      if (definition.dataSource && !validKeys.has(filter.field)) {
        errors.push(`Invalid filter field for ${definition.dataSource}: ${filter.field}`);
      }

      if (!filter.operator) {
        errors.push(`Filter ${i + 1}: operator is required`);
      }
      // isNull and isNotNull don't require a value
      if (filter.operator === 'isNull' || filter.operator === 'isNotNull') continue;
      if (filter.value === undefined || filter.value === null) {
        errors.push(`Filter ${i + 1}: value is required for '${filter.operator}' operator`);
      }
      if (filter.operator === 'between' && filter.value2 === undefined) {
        errors.push(`Filter ${i + 1}: value2 is required for 'between' operator`);
      }
    }
  }

  // Validate groupBy field
  if (definition.groupBy && definition.dataSource) {
    const validFields = getDataSourceFields(definition.dataSource);
    const validKeys = new Set(validFields.map((f) => f.key));
    if (!validKeys.has(definition.groupBy)) {
      errors.push(`Invalid groupBy field for ${definition.dataSource}: ${definition.groupBy}`);
    }
  }

  // Validate sortBy field
  if (definition.sortBy && definition.dataSource) {
    const validFields = getDataSourceFields(definition.dataSource);
    const validKeys = new Set(validFields.map((f) => f.key));
    if (!validKeys.has(definition.sortBy)) {
      errors.push(`Invalid sortBy field for ${definition.dataSource}: ${definition.sortBy}`);
    }
  }

  return errors;
}
