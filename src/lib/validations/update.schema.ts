/**
 * Entity Update Schemas — مخططات تحديث الكيانات
 *
 * Zod schemas for validating partial updates (PATCH/PUT) of every entity type.
 * All fields are optional to support partial updates.
 */

import { z } from 'zod';

// ===== Client =====

export const clientUpdateSchema = z.object({
  name: z.string().min(1, 'اسم العميل مطلوب').max(200).optional(),
  company: z.string().max(200).optional(),
  email: z.string().email('بريد إلكتروني غير صحيح').or(z.literal('')).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  taxNumber: z.string().max(100).optional(),
  creditLimit: z.coerce.number().optional(),
  paymentTerms: z.string().max(100).optional(),
  serviceType: z.string().max(100).optional(),
  serviceNotes: z.string().max(1000).optional(),
});

export type ClientUpdateData = z.infer<typeof clientUpdateSchema>;

// ===== Invoice =====

export const invoiceUpdateSchema = z.object({
  number: z.string().min(1, 'رقم الفاتورة مطلوب').max(50).optional(),
  clientId: z.string().min(1, 'العميل مطلوب').optional(),
  projectId: z.string().min(1, 'المشروع مطلوب').optional(),
  issueDate: z.string().min(1, 'تاريخ الإصدار مطلوب').optional(),
  dueDate: z.string().min(1, 'تاريخ الاستحقاق مطلوب').optional(),
  // Only explicit user transitions allowed via PUT are SENT and CANCELLED.
  // PAID, PARTIALLY_PAID, and OVERDUE are system-computed states (via recordPayment & cron).
  status: z.enum(['SENT', 'CANCELLED']).optional(),

});

export type InvoiceUpdateData = z.infer<typeof invoiceUpdateSchema>;

// ===== Invoice Item =====

export const invoiceItemUpdateSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999999),
  unitPrice: z.number().nonnegative().max(999999999),
  total: z.number().nonnegative().optional(),
  revenueCode: z.string().regex(/^(4010|4020|4100)$/).default("4010"),
});

// ===== Contract =====

export const contractUpdateSchema = z.object({
  number: z.string().min(1, 'رقم العقد مطلوب').max(50).optional(),
  title: z.string().min(1, 'عنوان العقد مطلوب').max(300).optional(),
  clientId: z.string().min(1, 'العميل مطلوب').optional(),
  projectId: z.string().optional(),
  value: z.coerce.number().optional(),
  type: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ContractUpdateData = z.infer<typeof contractUpdateSchema>;

// ===== Supplier =====

export const supplierUpdateSchema = z.object({
  name: z.string().min(1, 'اسم المورد مطلوب').max(200).optional(),
  category: z.string().max(100).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  creditLimit: z.coerce.number().optional(),
});

export type SupplierUpdateData = z.infer<typeof supplierUpdateSchema>;

// ===== Meeting =====

export const meetingUpdateSchema = z.object({
  title: z.string().min(1, 'عنوان الاجتماع مطلوب').max(300).optional(),
  date: z.string().min(1, 'التاريخ مطلوب').optional(),
  time: z.string().min(1, 'الوقت مطلوب').optional(),
  duration: z.coerce.number().min(15).optional(),
  projectId: z.string().optional(),
  location: z.string().max(300).optional(),
  type: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  attendeeIds: z.array(z.string()).optional(),
  agendaItems: z.array(z.object({ topic: z.string().max(300), duration: z.coerce.number().min(1) })).optional(),
});

export type MeetingUpdateData = z.infer<typeof meetingUpdateSchema>;

// ===== Bid =====

export const bidUpdateSchema = z.object({
  contractorName: z.string().max(200).optional(),
  contractorContact: z.string().max(200).optional(),
  amount: z.coerce.number().optional(),
  technicalScore: z.coerce.number().min(0).max(100).optional(),
  financialScore: z.coerce.number().min(0).max(100).optional(),
  totalScore: z.coerce.number().min(0).max(100).optional(),
  deadline: z.string().optional(),
  notes: z.string().max(5000).optional(),
  evaluationNotes: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
});

export type BidUpdateData = z.infer<typeof bidUpdateSchema>;

// ===== Document =====

export const documentUpdateSchema = z.object({
  name: z.string().max(500).optional(),
  fileType: z.string().max(50).optional(),
  fileSize: z.number().nonnegative().optional(),
  category: z.string().max(100).optional(),
  version: z.coerce.number().nonnegative().optional(),
  projectId: z.string().max(100).optional(),
  contractId: z.string().max(100).optional(),
  // SECURITY: uploadedById is intentionally excluded — set server-side only.
  // Allowing client-supplied uploadedById would enable impersonation.
});

export type DocumentUpdateData = z.infer<typeof documentUpdateSchema>;

// ===== Inspection =====

export const inspectionUpdateSchema = z.object({
  buildingName: z.string().max(300).optional(),
  buildingAddress: z.string().max(500).optional(),
  inspectionType: z.string().max(100).optional(),
  riskLevel: z.enum(['GREEN', 'YELLOW', 'ORANGE', 'RED']).optional(),
  inspectionDate: z.string().optional(),
  nextInspectionDate: z.string().optional(),
  inspectorName: z.string().max(200).optional(),
  summary: z.string().max(5000).optional(),
  recommendations: z.string().max(5000).optional(),
  repairEstimate: z.coerce.number().nonnegative().optional(),
  status: z.string().max(50).optional(),
});

export type InspectionUpdateData = z.infer<typeof inspectionUpdateSchema>;

// ===== Contractor =====

export const contractorUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).optional(),
  companyName: z.string().max(300).optional(),
  companyEn: z.string().max(300).optional(),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  address: z.string().max(500).optional(),
  crNumber: z.string().max(100).optional(),
  licenseNumber: z.string().max(100).optional(),
  licenseExpiry: z.string().optional(),
  category: z.string().max(50).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  specialties: z.string().max(1000).optional(),
  experience: z.string().max(1000).optional(),
  bankName: z.string().max(200).optional(),
  bankAccount: z.string().max(100).optional(),
  iban: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

export type ContractorUpdateData = z.infer<typeof contractorUpdateSchema>;

// ===== Budget =====

export const budgetUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  planned: z.coerce.number().optional(),
  actual: z.coerce.number().optional(),
  committed: z.coerce.number().optional(),
  remaining: z.coerce.number().optional(),
  deviation: z.coerce.number().optional(),
});

export type BudgetUpdateData = z.infer<typeof budgetUpdateSchema>;

// ===== Change Order =====

export const changeOrderUpdateSchema = z.object({
  number: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  costImpact: z.coerce.number().optional(),
  timeImpact: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
});

export type ChangeOrderUpdateData = z.infer<typeof changeOrderUpdateSchema>;

// ===== Inventory =====

export const inventoryUpdateSchema = z.object({
  name: z.string().max(300).optional(),
  projectId: z.string().optional(),
  quantity: z.coerce.number().optional(),
  unit: z.string().max(50).optional(),
  price: z.coerce.number().optional(),
  location: z.string().max(300).optional(),
  minimumLevel: z.coerce.number().optional(),
});

export type InventoryUpdateData = z.infer<typeof inventoryUpdateSchema>;

// ===== Automation =====

export const automationUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'PAUSED']).optional(),
});

export type AutomationUpdateData = z.infer<typeof automationUpdateSchema>;

// ===== Violation =====

export const violationUpdateSchema = z.object({
  type: z.string().max(100).optional(),
  severity: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
  contractorName: z.string().max(200).optional(),
  deadline: z.string().optional(),
  status: z.string().max(50).optional(),
  photoBefore: z.string().optional(),
  photoAfter: z.string().optional(),
  resolutionNotes: z.string().max(5000).optional(),
});

export type ViolationUpdateData = z.infer<typeof violationUpdateSchema>;

// ===== Site Visit =====

export const siteVisitUpdateSchema = z.object({
  date: z.string().optional(),
  plotNumber: z.string().max(100).optional(),
  municipality: z.string().max(100).optional(),
  gateDescription: z.string().max(500).optional(),
  neighborDesc: z.string().max(500).optional(),
  buildingDesc: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  photos: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export type SiteVisitUpdateData = z.infer<typeof siteVisitUpdateSchema>;

// ===== Risk =====

export const riskUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  category: z.string().max(50).optional(),
  probability: z.coerce.number().min(1).max(5).optional(),
  impact: z.coerce.number().min(1).max(5).optional(),
  mitigationPlan: z.string().max(5000).optional(),
  strategy: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
});

export type RiskUpdateData = z.infer<typeof riskUpdateSchema>;

// ===== Risk Action =====

export const riskActionUpdateSchema = z.object({
  description: z.string().max(2000).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().optional(),
});

export type RiskActionUpdateData = z.infer<typeof riskActionUpdateSchema>;

// ===== Design Drawing =====

export const designDrawingUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  drawingNumber: z.string().max(100).optional(),
  discipline: z.string().max(100).optional(),
  version: z.coerce.number().nonnegative().optional(),
  filePath: z.string().max(500).optional(),
  fileSize: z.number().nonnegative().optional(),
  status: z.string().max(50).optional(),
  reviewedBy: z.string().optional(),
  reviewNotes: z.string().max(2000).optional(),
  reviewedAt: z.string().optional(),
  clashDetected: z.boolean().optional(),
  clashNotes: z.string().max(2000).optional(),
});

export type DesignDrawingUpdateData = z.infer<typeof designDrawingUpdateSchema>;

// ===== Transmittal =====

export const transmittalUpdateSchema = z.object({
  subject: z.string().max(300).optional(),
  toName: z.string().max(200).optional(),
  toEmail: z.string().email().or(z.literal('')).optional(),
  toCompany: z.string().max(200).optional(),
  toPhone: z.string().max(50).optional(),
  deliveryMethod: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
});

export type TransmittalUpdateData = z.infer<typeof transmittalUpdateSchema>;

// ===== Transmittal Item =====

export const transmittalItemUpdateSchema = z.object({
  documentNumber: z.string().max(100).optional(),
  title: z.string().max(300).optional(),
  revision: z.string().max(50).optional(),
  copies: z.coerce.number().nonnegative().optional(),
  purpose: z.string().max(100).optional(),
  received: z.boolean().optional(),
  approved: z.boolean().optional(),
  rejected: z.boolean().optional(),
  needsRevision: z.boolean().optional(),
  replyNotes: z.string().max(2000).optional(),
});

export type TransmittalItemUpdateData = z.infer<typeof transmittalItemUpdateSchema>;

// ===== Leave =====

export const leaveUpdateSchema = z.object({
  type: z.string().max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.coerce.number().positive().optional(),
  reason: z.string().max(2000).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

export type LeaveUpdateData = z.infer<typeof leaveUpdateSchema>;

// ===== Proposal =====

export const proposalUpdateSchema = z.object({
  number: z.string().max(50).optional(),
  clientId: z.string().cuid().optional(),
  projectId: z.string().optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
});

export type ProposalUpdateData = z.infer<typeof proposalUpdateSchema>;

// ===== Site Diary =====

export const siteDiaryUpdateSchema = z.object({
  date: z.string().optional(),
  weather: z.string().max(200).optional(),
  workerCount: z.coerce.number().nonnegative().optional(),
  workDescription: z.string().max(5000).optional(),
  issues: z.string().max(5000).optional(),
  safetyNotes: z.string().max(5000).optional(),
  equipment: z.string().max(5000).optional(),
  materials: z.string().max(5000).optional(),
  photos: z.string().optional(),
});

export type SiteDiaryUpdateData = z.infer<typeof siteDiaryUpdateSchema>;

// ===== Knowledge Article =====

export const knowledgeArticleUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(50000).optional(),
  category: z.string().max(50).optional(),
  tags: z.string().max(500).optional(),
  authorId: z.string().optional(),
});

export type KnowledgeArticleUpdateData = z.infer<typeof knowledgeArticleUpdateSchema>;

// ===== Equipment =====

export const equipmentUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  type: z.string().max(100).optional(),
  model: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  location: z.string().max(300).optional(),
  dailyRate: z.coerce.number().optional(),
  lastMaintenance: z.string().optional(),
  nextMaintenance: z.string().optional(),
});

export type EquipmentUpdateData = z.infer<typeof equipmentUpdateSchema>;

// ===== Defect =====

export const defectUpdateSchema = z.object({
  title: z.string().max(300).optional(),
  severity: z.string().max(50).optional(),
  location: z.string().max(300).optional(),
  assigneeId: z.string().optional(),
  photos: z.string().optional(),
  resolutionNotes: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
});

export type DefectUpdateData = z.infer<typeof defectUpdateSchema>;

// ===== RFI =====

export const rfiUpdateSchema = z.object({
  number: z.string().max(50).optional(),
  subject: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  priority: z.string().max(50).optional(),
  dueDate: z.string().optional(),
  response: z.string().max(10000).optional(),
  status: z.string().max(50).optional(),
});

export type RfiUpdateData = z.infer<typeof rfiUpdateSchema>;

// ===== Submittal =====

export const submittalUpdateSchema = z.object({
  number: z.string().max(50).optional(),
  title: z.string().max(300).optional(),
  type: z.string().max(100).optional(),
  contractor: z.string().max(200).optional(),
  revisionNumber: z.coerce.number().nonnegative().optional(),
  status: z.enum(['UNDER_REVIEW', 'APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED', 'RESUBMIT']).optional(),
  reviewNotes: z.string().max(5000).optional(),
  reviewedBy: z.string().max(200).optional(),
  reviewedAt: z.string().optional(),
});

export type SubmittalUpdateData = z.infer<typeof submittalUpdateSchema>;

// ===== Commission =====

export const commissionUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  approvedById: z.string().optional(),
  paidDate: z.string().optional(),
});

export type CommissionUpdateData = z.infer<typeof commissionUpdateSchema>;

// ===== Attendance =====

export const attendanceUpdateSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.string().max(50).optional(),
  workHours: z.coerce.number().nonnegative().optional(),
  overtimeHours: z.coerce.number().nonnegative().optional(),
});

export type AttendanceUpdateData = z.infer<typeof attendanceUpdateSchema>;

// ===== Referral =====

export const referralUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  discountGiven: z.coerce.number().optional(),
  rewardAmount: z.coerce.number().optional(),
  notes: z.string().max(2000).optional(),
});

export type ReferralUpdateData = z.infer<typeof referralUpdateSchema>;

// ===== Marketing Campaign =====

export const marketingCampaignUpdateSchema = z.object({
  name: z.string().max(300).optional(),
  type: z.string().max(100).optional(),
  budget: z.coerce.number().optional(),
  spent: z.coerce.number().optional(),
  leads: z.coerce.number().optional(),
  conversions: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
});

export type MarketingCampaignUpdateData = z.infer<typeof marketingCampaignUpdateSchema>;

// ===== Tender =====

export const tenderUpdateSchema = z.object({
  tenderNumber: z.string().max(50).optional(),
  title: z.string().max(300).optional(),
  authority: z.string().max(200).optional(),
  projectType: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  estimatedBudget: z.coerce.number().optional(),
  currency: z.string().max(10).optional(),
  closingDate: z.string().optional(),
  submissionDate: z.string().optional(),
  qualifications: z.string().max(5000).optional(),
  requiredDocs: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  winnerName: z.string().max(200).optional(),
  lostReason: z.string().max(2000).optional(),
  competitorAnalysis: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(100).optional(),
  sourceUrl: z.string().max(500).optional(),
  assignedTo: z.string().optional(),
});

export type TenderUpdateData = z.infer<typeof tenderUpdateSchema>;

// ===== Supervision Checklist =====

export const supervisionChecklistUpdateSchema = z.object({
  stage: z.string().max(100).optional(),
  title: z.string().max(300).optional(),
  visitDate: z.string().optional(),
  engineerId: z.string().optional(),
  weather: z.string().max(200).optional(),
  temperature: z.string().max(50).optional(),
  workerCount: z.coerce.number().nonnegative().optional(),
  contractorName: z.string().max(200).optional(),
  progressOverall: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  approvedById: z.string().optional(),
});

export type SupervisionChecklistUpdateData = z.infer<typeof supervisionChecklistUpdateSchema>;

// ===== Design Phase =====

export const designPhaseUpdateSchema = z.object({
  phase: z.string().max(50).optional(),
  phaseNameAr: z.string().max(200).optional(),
  phaseNameEn: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  designerId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  completedDate: z.string().optional(),
  revisionCount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(5000).optional(),
  clientApproval: z.boolean().optional(),
});

export type DesignPhaseUpdateData = z.infer<typeof designPhaseUpdateSchema>;

// ===== Workflow Template =====

export const workflowTemplateUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  nameEn: z.string().max(200).optional(),
  projectType: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export type WorkflowTemplateUpdateData = z.infer<typeof workflowTemplateUpdateSchema>;

// ===== Approval =====

export const approvalUpdateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  notes: z.string().max(2000).optional(),
});

export type ApprovalUpdateData = z.infer<typeof approvalUpdateSchema>;

// ===== Purchase Order =====

export const purchaseOrderUpdateSchema = z.object({
  number: z.string().max(50).optional(),
  supplierId: z.string().optional(),
  projectId: z.string().optional(),
  amount: z.coerce.number().optional(),
  status: z.string().max(50).optional(),
});

export type PurchaseOrderUpdateData = z.infer<typeof purchaseOrderUpdateSchema>;
