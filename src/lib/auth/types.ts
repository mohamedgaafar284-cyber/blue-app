/**
 * Authentication Types
 * أنواع المصادقة والتفويض
 */

// Role values for permission mapping (string constants, client-safe)
// NOTE: These are plain strings, not Prisma enums, so they work on both
// server and client. The Prisma UserRole enum is only available server-side.
export const UserRoleValues = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  ENGINEER: 'ENGINEER',
  DRAFTSMAN: 'DRAFTSMAN',
  ACCOUNTANT: 'ACCOUNTANT',
  HR: 'HR',
  SECRETARY: 'SECRETARY',
  VIEWER: 'VIEWER',
} as const;

/**
 * Permission definitions
 */
export enum Permission {
  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  
  // Task permissions
  TASK_CREATE = 'task:create',
  TASK_READ = 'task:read',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',
  
  // Client permissions
  CLIENT_CREATE = 'client:create',
  CLIENT_READ = 'client:read',
  CLIENT_UPDATE = 'client:update',
  CLIENT_DELETE = 'client:delete',
  
  // Invoice permissions
  INVOICE_CREATE = 'invoice:create',
  INVOICE_READ = 'invoice:read',
  INVOICE_UPDATE = 'invoice:update',
  INVOICE_DELETE = 'invoice:delete',
  
  // User management permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // Settings permissions
  SETTINGS_READ = 'settings:read',
  SETTINGS_UPDATE = 'settings:update',
  
  // Reports permissions
  REPORTS_READ = 'reports:read',
  REPORTS_EXPORT = 'reports:export',
  
  // Budget permissions
  BUDGET_MANAGE = 'budget:manage',
  
  // Document permissions
  DOCUMENT_CREATE = 'document:create',
  DOCUMENT_READ = 'document:read',
  DOCUMENT_UPDATE = 'document:update',
  DOCUMENT_DELETE = 'document:delete',

  // Contract permissions
  CONTRACT_CREATE = 'contract:create',
  CONTRACT_READ = 'contract:read',
  CONTRACT_UPDATE = 'contract:update',
  CONTRACT_DELETE = 'contract:delete',

  // Contractor permissions
  CONTRACTOR_CREATE = 'contractor:create',
  CONTRACTOR_READ = 'contractor:read',
  CONTRACTOR_UPDATE = 'contractor:update',
  CONTRACTOR_DELETE = 'contractor:delete',

  // Bid permissions
  BID_CREATE = 'bid:create',
  BID_READ = 'bid:read',
  BID_UPDATE = 'bid:update',
  BID_DELETE = 'bid:delete',

  // Meeting permissions
  MEETING_CREATE = 'meeting:create',
  MEETING_READ = 'meeting:read',
  MEETING_UPDATE = 'meeting:update',
  MEETING_DELETE = 'meeting:delete',

  // Site diary permissions
  SITE_DIARY_CREATE = 'site_diary:create',
  SITE_DIARY_READ = 'site_diary:read',
  SITE_DIARY_UPDATE = 'site_diary:update',
  SITE_DIARY_DELETE = 'site_diary:delete',

  // Violation permissions
  VIOLATION_CREATE = 'violation:create',
  VIOLATION_READ = 'violation:read',
  VIOLATION_UPDATE = 'violation:update',
  VIOLATION_DELETE = 'violation:delete',

  // Submittal permissions
  SUBMITTAL_CREATE = 'submittal:create',
  SUBMITTAL_READ = 'submittal:read',
  SUBMITTAL_UPDATE = 'submittal:update',
  SUBMITTAL_DELETE = 'submittal:delete',

  // Inspection permissions
  INSPECTION_CREATE = 'inspection:create',
  INSPECTION_READ = 'inspection:read',
  INSPECTION_UPDATE = 'inspection:update',
  INSPECTION_DELETE = 'inspection:delete',

  // Supplier permissions
  SUPPLIER_CREATE = 'supplier:create',
  SUPPLIER_READ = 'supplier:read',
  SUPPLIER_UPDATE = 'supplier:update',
  SUPPLIER_DELETE = 'supplier:delete',

  // Change order permissions
  CHANGE_ORDER_CREATE = 'change_order:create',
  CHANGE_ORDER_READ = 'change_order:read',
  CHANGE_ORDER_UPDATE = 'change_order:update',
  CHANGE_ORDER_DELETE = 'change_order:delete',

  // Approval permissions
  APPROVAL_CREATE = 'approval:create',
  APPROVAL_READ = 'approval:read',
  APPROVAL_UPDATE = 'approval:update',
  APPROVAL_DELETE = 'approval:delete',

  // Proposal permissions
  PROPOSAL_CREATE = 'proposal:create',
  PROPOSAL_READ = 'proposal:read',
  PROPOSAL_UPDATE = 'proposal:update',
  PROPOSAL_DELETE = 'proposal:delete',

  // Commission permissions
  COMMISSION_CREATE = 'commission:create',
  COMMISSION_READ = 'commission:read',
  COMMISSION_UPDATE = 'commission:update',
  COMMISSION_DELETE = 'commission:delete',

  // Payment permissions
  PAYMENT_CREATE = 'payment:create',
  PAYMENT_READ = 'payment:read',
  PAYMENT_UPDATE = 'payment:update',
  PAYMENT_DELETE = 'payment:delete',

  // Purchase order permissions
  PURCHASE_ORDER_CREATE = 'purchase_order:create',
  PURCHASE_ORDER_READ = 'purchase_order:read',
  PURCHASE_ORDER_UPDATE = 'purchase_order:update',
  PURCHASE_ORDER_DELETE = 'purchase_order:delete',

  // Inventory permissions
  INVENTORY_CREATE = 'inventory:create',
  INVENTORY_READ = 'inventory:read',
  INVENTORY_UPDATE = 'inventory:update',
  INVENTORY_DELETE = 'inventory:delete',

  // Defect permissions
  DEFECT_CREATE = 'defect:create',
  DEFECT_READ = 'defect:read',
  DEFECT_UPDATE = 'defect:update',
  DEFECT_DELETE = 'defect:delete',

  // Risk permissions
  RISK_CREATE = 'risk:create',
  RISK_READ = 'risk:read',
  RISK_UPDATE = 'risk:update',
  RISK_DELETE = 'risk:delete',

  // Employee management permissions
  EMPLOYEE_READ = 'employee:read',
  EMPLOYEE_UPDATE = 'employee:update',
  EMPLOYEE_DELETE = 'employee:delete',

  // Notification permissions (user-level: users manage their own notifications)
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_UPDATE = 'notification:update',
  NOTIFICATION_DELETE = 'notification:delete',

  // Search permissions
  SEARCH_READ = 'search:read',
}

/**
 * Role to permissions mapping
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [UserRoleValues.ADMIN]: Object.values(Permission),
  
  [UserRoleValues.MANAGER]: [
    Permission.PROJECT_CREATE, Permission.PROJECT_READ, Permission.PROJECT_UPDATE, Permission.PROJECT_DELETE,
    Permission.TASK_CREATE, Permission.TASK_READ, Permission.TASK_UPDATE, Permission.TASK_DELETE,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE, Permission.CLIENT_DELETE,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE, Permission.INVOICE_DELETE,
    Permission.USER_READ, Permission.USER_CREATE, Permission.USER_UPDATE,
    Permission.REPORTS_READ, Permission.REPORTS_EXPORT,
    Permission.DOCUMENT_CREATE, Permission.DOCUMENT_READ, Permission.DOCUMENT_UPDATE, Permission.DOCUMENT_DELETE,
    Permission.CONTRACT_CREATE, Permission.CONTRACT_READ, Permission.CONTRACT_UPDATE, Permission.CONTRACT_DELETE,
    Permission.CONTRACTOR_CREATE, Permission.CONTRACTOR_READ, Permission.CONTRACTOR_UPDATE, Permission.CONTRACTOR_DELETE,
    Permission.BUDGET_MANAGE, Permission.SETTINGS_READ, Permission.SETTINGS_UPDATE,
    // New permissions for Manager
    Permission.BID_CREATE, Permission.BID_READ, Permission.BID_UPDATE, Permission.BID_DELETE,
    Permission.MEETING_CREATE, Permission.MEETING_READ, Permission.MEETING_UPDATE, Permission.MEETING_DELETE,
    Permission.SITE_DIARY_CREATE, Permission.SITE_DIARY_READ, Permission.SITE_DIARY_UPDATE, Permission.SITE_DIARY_DELETE,
    Permission.VIOLATION_CREATE, Permission.VIOLATION_READ, Permission.VIOLATION_UPDATE, Permission.VIOLATION_DELETE,
    Permission.SUBMITTAL_CREATE, Permission.SUBMITTAL_READ, Permission.SUBMITTAL_UPDATE, Permission.SUBMITTAL_DELETE,
    Permission.INSPECTION_CREATE, Permission.INSPECTION_READ, Permission.INSPECTION_UPDATE, Permission.INSPECTION_DELETE,
    Permission.SUPPLIER_CREATE, Permission.SUPPLIER_READ, Permission.SUPPLIER_UPDATE, Permission.SUPPLIER_DELETE,
    Permission.CHANGE_ORDER_CREATE, Permission.CHANGE_ORDER_READ, Permission.CHANGE_ORDER_UPDATE, Permission.CHANGE_ORDER_DELETE,
    Permission.APPROVAL_CREATE, Permission.APPROVAL_READ, Permission.APPROVAL_UPDATE, Permission.APPROVAL_DELETE,
    Permission.PROPOSAL_CREATE, Permission.PROPOSAL_READ, Permission.PROPOSAL_UPDATE, Permission.PROPOSAL_DELETE,
    Permission.COMMISSION_CREATE, Permission.COMMISSION_READ, Permission.COMMISSION_UPDATE, Permission.COMMISSION_DELETE,
    Permission.PAYMENT_CREATE, Permission.PAYMENT_READ, Permission.PAYMENT_UPDATE, Permission.PAYMENT_DELETE,
    Permission.PURCHASE_ORDER_CREATE, Permission.PURCHASE_ORDER_READ, Permission.PURCHASE_ORDER_UPDATE, Permission.PURCHASE_ORDER_DELETE,
    Permission.INVENTORY_CREATE, Permission.INVENTORY_READ, Permission.INVENTORY_UPDATE, Permission.INVENTORY_DELETE,
    Permission.DEFECT_CREATE, Permission.DEFECT_READ, Permission.DEFECT_UPDATE, Permission.DEFECT_DELETE,
    Permission.RISK_CREATE, Permission.RISK_READ, Permission.RISK_UPDATE, Permission.RISK_DELETE,
    Permission.EMPLOYEE_READ, Permission.EMPLOYEE_UPDATE, Permission.EMPLOYEE_DELETE,
    // Notification + Search permissions for Manager
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],

  [UserRoleValues.PROJECT_MANAGER]: [
    Permission.PROJECT_CREATE, Permission.PROJECT_READ, Permission.PROJECT_UPDATE,
    Permission.TASK_CREATE, Permission.TASK_READ, Permission.TASK_UPDATE, Permission.TASK_DELETE,
    Permission.CLIENT_READ,
    Permission.INVOICE_READ,
    Permission.DOCUMENT_READ, Permission.DOCUMENT_CREATE,
    Permission.CONTRACT_READ, Permission.CONTRACT_UPDATE,
    Permission.CONTRACTOR_READ, Permission.CONTRACTOR_CREATE,
    Permission.REPORTS_READ,
    // New permissions for Project Manager
    Permission.BID_CREATE, Permission.BID_READ, Permission.BID_UPDATE,
    Permission.MEETING_CREATE, Permission.MEETING_READ, Permission.MEETING_UPDATE,
    Permission.SITE_DIARY_CREATE, Permission.SITE_DIARY_READ, Permission.SITE_DIARY_UPDATE,
    Permission.VIOLATION_READ,
    Permission.SUBMITTAL_CREATE, Permission.SUBMITTAL_READ, Permission.SUBMITTAL_UPDATE,
    Permission.INSPECTION_CREATE, Permission.INSPECTION_READ, Permission.INSPECTION_UPDATE,
    Permission.SUPPLIER_READ,
    Permission.CHANGE_ORDER_CREATE, Permission.CHANGE_ORDER_READ, Permission.CHANGE_ORDER_UPDATE,
    Permission.APPROVAL_CREATE, Permission.APPROVAL_READ, Permission.APPROVAL_UPDATE,
    Permission.PROPOSAL_CREATE, Permission.PROPOSAL_READ, Permission.PROPOSAL_UPDATE,
    Permission.COMMISSION_READ,
    Permission.PAYMENT_READ,
    Permission.PURCHASE_ORDER_CREATE, Permission.PURCHASE_ORDER_READ, Permission.PURCHASE_ORDER_UPDATE,
    Permission.INVENTORY_READ,
    Permission.DEFECT_CREATE, Permission.DEFECT_READ, Permission.DEFECT_UPDATE,
    Permission.RISK_CREATE, Permission.RISK_READ, Permission.RISK_UPDATE,
    Permission.EMPLOYEE_READ,
    // Notification + Search permissions for Project Manager
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],

  [UserRoleValues.ENGINEER]: [
    Permission.PROJECT_READ,
    Permission.TASK_CREATE, Permission.TASK_READ, Permission.TASK_UPDATE,
    Permission.DOCUMENT_CREATE,
    Permission.CLIENT_READ,
    Permission.INVOICE_READ,
    Permission.CONTRACT_READ,
    Permission.CONTRACTOR_READ,
    Permission.REPORTS_READ,
    // New permissions for Engineer
    Permission.BID_READ,
    Permission.MEETING_CREATE, Permission.MEETING_READ,
    Permission.SITE_DIARY_CREATE, Permission.SITE_DIARY_READ, Permission.SITE_DIARY_UPDATE,
    Permission.VIOLATION_READ,
    Permission.SUBMITTAL_CREATE, Permission.SUBMITTAL_READ,
    Permission.INSPECTION_CREATE, Permission.INSPECTION_READ, Permission.INSPECTION_UPDATE,
    Permission.SUPPLIER_READ,
    Permission.CHANGE_ORDER_READ,
    Permission.APPROVAL_READ,
    Permission.PROPOSAL_READ,
    Permission.PAYMENT_READ,
    Permission.PURCHASE_ORDER_READ,
    Permission.INVENTORY_READ,
    Permission.DEFECT_CREATE, Permission.DEFECT_READ, Permission.DEFECT_UPDATE,
    Permission.RISK_CREATE, Permission.RISK_READ, Permission.RISK_UPDATE,
    Permission.EMPLOYEE_READ,
    // Notification + Search permissions for Engineer
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],
  
  [UserRoleValues.ACCOUNTANT]: [
    Permission.PROJECT_READ,
    Permission.TASK_READ,
    Permission.CLIENT_CREATE, Permission.CLIENT_READ, Permission.CLIENT_UPDATE,
    Permission.INVOICE_CREATE, Permission.INVOICE_READ, Permission.INVOICE_UPDATE,
    Permission.CONTRACT_READ, Permission.CONTRACT_CREATE, Permission.CONTRACT_UPDATE,
    Permission.REPORTS_READ, Permission.REPORTS_EXPORT,
    Permission.BUDGET_MANAGE,
    // New permissions for Accountant
    Permission.BID_READ,
    Permission.COMMISSION_CREATE, Permission.COMMISSION_READ, Permission.COMMISSION_UPDATE,
    Permission.PAYMENT_CREATE, Permission.PAYMENT_READ, Permission.PAYMENT_UPDATE,
    Permission.PURCHASE_ORDER_CREATE, Permission.PURCHASE_ORDER_READ, Permission.PURCHASE_ORDER_UPDATE,
    Permission.SUPPLIER_READ,
    Permission.CHANGE_ORDER_READ,
    Permission.APPROVAL_READ,
    Permission.PROPOSAL_READ,
    Permission.EMPLOYEE_READ,
    // Notification + Search permissions for Accountant
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],

  [UserRoleValues.HR]: [
    Permission.USER_READ, Permission.USER_CREATE, Permission.USER_UPDATE,
    Permission.CONTRACTOR_READ,
    Permission.REPORTS_READ,
    Permission.SETTINGS_READ, Permission.SETTINGS_UPDATE,
    // New permissions for HR
    Permission.EMPLOYEE_READ, Permission.EMPLOYEE_UPDATE, Permission.EMPLOYEE_DELETE,
    Permission.MEETING_READ,
    Permission.APPROVAL_READ,
    Permission.VIOLATION_READ,
    // Notification + Search permissions for HR
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],

  [UserRoleValues.DRAFTSMAN]: [
    Permission.PROJECT_READ,
    Permission.TASK_CREATE, Permission.TASK_READ, Permission.TASK_UPDATE,
    Permission.DOCUMENT_CREATE, Permission.DOCUMENT_READ, Permission.DOCUMENT_UPDATE,
    Permission.CONTRACT_READ,
    Permission.REPORTS_READ,
    // New permissions for Draftsman
    Permission.BID_READ,
    Permission.MEETING_READ,
    Permission.SITE_DIARY_READ,
    Permission.SUBMITTAL_READ,
    Permission.INSPECTION_READ,
    Permission.SUPPLIER_READ,
    Permission.CHANGE_ORDER_READ,
    Permission.DEFECT_READ,
    Permission.RISK_READ,
    // Notification + Search permissions for Draftsman
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],

  [UserRoleValues.SECRETARY]: [
    Permission.PROJECT_READ,
    Permission.TASK_READ,
    Permission.CLIENT_READ, Permission.CLIENT_UPDATE,
    Permission.INVOICE_READ,
    Permission.DOCUMENT_CREATE, Permission.DOCUMENT_READ, Permission.DOCUMENT_UPDATE,
    Permission.CONTRACT_READ,
    Permission.CONTRACTOR_READ,
    Permission.REPORTS_READ,
    // New permissions for Secretary
    Permission.BID_READ,
    Permission.MEETING_CREATE, Permission.MEETING_READ,
    Permission.SITE_DIARY_READ,
    Permission.SUBMITTAL_CREATE, Permission.SUBMITTAL_READ,
    Permission.INSPECTION_READ,
    Permission.SUPPLIER_READ,
    Permission.CHANGE_ORDER_READ,
    Permission.APPROVAL_READ,
    Permission.PROPOSAL_READ,
    Permission.PAYMENT_READ,
    Permission.PURCHASE_ORDER_READ,
    Permission.INVENTORY_READ,
    Permission.EMPLOYEE_READ,
    // Notification + Search permissions for Secretary
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],

  [UserRoleValues.VIEWER]: [
    Permission.PROJECT_READ,
    Permission.TASK_READ,
    Permission.CLIENT_READ,
    Permission.INVOICE_READ,
    Permission.CONTRACT_READ,
    Permission.CONTRACTOR_READ,
    Permission.DOCUMENT_READ,
    // New read-only permissions for Viewer
    Permission.BID_READ,
    Permission.MEETING_READ,
    Permission.SITE_DIARY_READ,
    Permission.VIOLATION_READ,
    Permission.SUBMITTAL_READ,
    Permission.INSPECTION_READ,
    Permission.SUPPLIER_READ,
    Permission.CHANGE_ORDER_READ,
    Permission.APPROVAL_READ,
    Permission.PROPOSAL_READ,
    Permission.PAYMENT_READ,
    Permission.PURCHASE_ORDER_READ,
    Permission.INVENTORY_READ,
    Permission.DEFECT_READ,
    Permission.RISK_READ,
    // Notification + Search permissions for Viewer (read-only)
    Permission.NOTIFICATION_READ, Permission.NOTIFICATION_UPDATE, Permission.NOTIFICATION_DELETE,
    Permission.SEARCH_READ,
  ],
};

/**
 * JWT Token payload structure
 */
export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  organizationId?: string;
  department?: string;
  iat?: number;
  exp?: number;
}

/**
 * Login request data
 * Supports login with either email or username
 */
export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Signup request data
 */
export interface SignupRequest {
  email: string;
  username: string;
  password: string;
  fullName: string;
  organizationName?: string;
  role?: string;
  department?: string;
}

/**
 * User object in auth response
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  role: string;
  avatar: string | null;
  organizationId: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  refreshToken?: string;
  error?: string;
  code?: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset confirmation
 */
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Password change request
 */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  userId: string;
  token: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}
