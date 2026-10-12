import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string()
    .min(1, 'كلمة المرور مطلوبة')
    .max(128, 'كلمة المرور طويلة جداً'),
  organizationSlug: z.string().optional(),
  organizationId: z.string().optional(),
});

export type LoginData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(128, 'كلمة المرور طويلة جداً'),
  name: z.string()
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .max(100, 'الاسم طويل جداً')
    .optional()
    .default(''),
  fullName: z.string()
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .max(100, 'الاسم طويل جداً')
    .optional()
    .default(''),
  organizationName: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  // SECURITY: role is intentionally excluded — roles are assigned server-side only.
  // Allowing client-supplied role would enable privilege escalation.
  action: z.string().optional(),
});

export type RegisterData = z.infer<typeof registerSchema>;

/**
 * First-run setup wizard (creates the very first ADMIN account).
 * SECURITY: the role is NOT accepted from the client — it is always ADMIN
 * server-side, and the endpoint refuses to run once any user exists.
 */
export const setupAdminSchema = z.object({
  organizationName: z.string()
    .min(2, 'اسم الشركة يجب أن يكون حرفين على الأقل')
    .max(200, 'اسم الشركة طويل جداً'),
  taxNumber: z.string().max(50).optional(),
  adminName: z.string()
    .min(2, 'الاسم يجب أن يكون حرفين على الأقل')
    .max(100, 'الاسم طويل جداً'),
  adminEmail: z.string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('صيغة البريد الإلكتروني غير صحيحة')
    .max(200),
  adminPassword: z.string()
    .min(12, 'كلمة مرور المدير يجب أن تكون 12 خانة على الأقل')
    .max(128, 'كلمة المرور طويلة جداً'),
});

export type SetupAdminData = z.infer<typeof setupAdminSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('صيغة البريد الإلكتروني غير صحيحة'),
});

export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'رمز إعادة التعيين مطلوب'),
  password: z.string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(128, 'كلمة المرور طويلة جداً'),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => !data.confirmPassword || data.password === data.confirmPassword,
  { message: 'كلمات المرور غير متطابقة', path: ['confirmPassword'] }
);

export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z.string()
    .min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    .max(128, 'كلمة المرور طويلة جداً'),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => !data.confirmPassword || data.newPassword === data.confirmPassword,
  { message: 'كلمات المرور غير متطابقة', path: ['confirmPassword'] }
);

export type ChangePasswordData = z.infer<typeof changePasswordSchema>;

export const twoFactorSetupSchema = z.object({
  action: z.enum(['setup', 'enable'], {
    message: 'إجراء غير صحيح — يجب أن يكون setup أو enable',
  }),
  code: z.string()
    .regex(/^\d{6}$/, 'رمز التحقق يجب أن يكون 6 أرقام')
    .optional(),
}).refine(
  (data) => data.action !== 'enable' || !!data.code,
  { message: 'رمز التحقق مطلوب عند التفعيل', path: ['code'] }
);

export type TwoFactorSetupData = z.infer<typeof twoFactorSetupSchema>;

export const twoFactorDisableSchema = z.object({
  password: z.string()
    .min(1, 'كلمة المرور مطلوبة')
    .max(128, 'كلمة المرور طويلة جداً'),
});

export type TwoFactorDisableData = z.infer<typeof twoFactorDisableSchema>;

export const twoFactorVerifySchema = z.object({
  code: z.string()
    .min(1, 'الرمز مطلوب')
    .regex(/^\d{6}|\d{8}$/, 'صيغة الرمز غير صحيحة — يجب أن يكون 6 أرقام (TOTP) أو 8 أرقام (رمز احتياطي)')
    .max(8, 'الرمز طويل جداً'),
});

export type TwoFactorVerifyData = z.infer<typeof twoFactorVerifySchema>;
