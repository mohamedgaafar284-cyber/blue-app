import { z } from 'zod';

const safeNumber = z.coerce.number().optional().default(0);

export const projectCreateSchema = z.object({
  number: z.string().max(50).optional().default(''),
  name: z.string().min(1, 'اسم المشروع مطلوب').max(200),
  nameEn: z.string().max(200).optional().default(''),
  clientId: z.string().min(1, 'العميل مطلوب'),
  contractorId: z.string().optional().default(''),
  location: z.string().max(200).optional().default(''),
  plotNumber: z.string().max(100).optional().default(''),
  type: z.string().min(1, 'نوع المشروع مطلوب').max(50),
  budget: safeNumber,
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  description: z.string().max(5000).optional().default(''),
  status: z.string().max(50).optional().default('ACTIVE'),
  progress: z.coerce.number().min(0).max(100).optional().default(0),
});

export type ProjectCreateData = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  name: z.string().min(1, 'اسم المشروع مطلوب').max(200).optional(),
  nameEn: z.string().max(200).optional(),
  clientId: z.string().min(1, 'العميل مطلوب').optional(),
  contractorId: z.string().optional(),
  location: z.string().max(200).optional(),
  plotNumber: z.string().max(100).optional(),
  type: z.string().min(1, 'نوع المشروع مطلوب').max(50).optional(),
  budget: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
});

export type ProjectUpdateData = z.infer<typeof projectUpdateSchema>;

export const taskCreateSchema = z.object({
  title: z.string().min(1, 'عنوان المهمة مطلوب').max(300),
  description: z.string().max(5000).optional().default(''),
  projectId: z.string().optional().default(''),
  assigneeId: z.string().optional().default(''),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  status: z.string().max(50).default('TODO'),
  startDate: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  progress: z.coerce.number().min(0).max(100).optional().default(0),
  taskType: z.enum(['STANDARD', 'GOVERNMENTAL', 'MANDATORY', 'CLIENT', 'INTERNAL']).optional().default('STANDARD'),
  isGovernmental: z.boolean().optional().default(false), // kept for backward compatibility with frontend
  slaDays: z.coerce.number().optional().default(0),
});

export type TaskCreateData = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = z.object({
  title: z.string().min(1, 'عنوان المهمة مطلوب').max(300).optional(),
  description: z.string().max(5000).optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED', 'todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  isGovernmental: z.boolean().optional(), // kept for backward compatibility
  taskType: z.enum(['STANDARD', 'GOVERNMENTAL', 'MANDATORY', 'CLIENT', 'INTERNAL']).optional(),
  slaDays: z.coerce.number().optional(),
});

export type TaskUpdateData = z.infer<typeof taskUpdateSchema>;

export const siteVisitCreateSchema = z.object({
  projectId: z.string().min(1, 'المشروع مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  plotNumber: z.string().max(100).optional().default(''),
  municipality: z.string().max(100).optional().default(''),
  gateDescription: z.string().max(500).optional().default(''),
  neighborDesc: z.string().max(500).optional().default(''),
  buildingDesc: z.string().max(500).optional().default(''),
  status: z.string().max(50).optional().default('PENDING'),
  photos: z.string().optional().default(''),
  notes: z.string().max(5000).optional().default(''),
  visitors: z.string().max(1000).optional().default(''),
  purpose: z.string().max(1000).optional().default(''),
  findings: z.string().max(5000).optional().default(''),
});

export type SiteVisitCreateData = z.infer<typeof siteVisitCreateSchema>;

export const siteDiarySchema = z.object({
  projectId: z.string().min(1, 'المشروع مطلوب'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  weather: z.string().max(200).optional().default(''),
  workerCount: z.coerce.number().min(0).optional().default(0),
  workDescription: z.string().max(5000).optional().default(''),
  issues: z.string().max(5000).optional().default(''),
  safetyNotes: z.string().max(5000).optional().default(''),
  equipment: z.string().max(5000).optional().default(''),
  materials: z.string().max(5000).optional().default(''),
  photos: z.string().optional().default(''),
});

export type SiteDiaryData = z.infer<typeof siteDiarySchema>;

export const govApprovalSchema = z.object({
  projectId: z.string().min(1, 'المشروع مطلوب'),
  authority: z.string().min(1).max(50),
  status: z.string().max(50).default('PENDING'),
  submissionDate: z.string().optional().default(''),
  approvalDate: z.string().optional().default(''),
  notes: z.string().max(2000).optional().default(''),
});

export type GovApprovalData = z.infer<typeof govApprovalSchema>;
