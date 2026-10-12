export interface Props {
  language: "ar" | "en";
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  department: string;
  position: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatar: string; role: string };
}

export interface BackupRecord {
  id: string;
  filename: string;
  timestamp: string;
  size: number;
  status: string;
}

export interface NewUserData {
  name: string;
  email: string;
  role: string;
  department: string;
  position: string;
  phone: string;
  // Optional: when empty, the server generates a temporary password and
  // returns it ONCE in the creation response (shown in TempPasswordDialog)
  password?: string;
}

export const roleLabels: Record<string, { ar: string; en: string }> = {
  ADMIN: { ar: "مدير النظام", en: "System Admin" },
  MANAGER: { ar: "المدير", en: "Manager" },
  PROJECT_MANAGER: { ar: "مدير مشاريع", en: "Project Manager" },
  ENGINEER: { ar: "مهندس", en: "Engineer" },
  DRAFTSMAN: { ar: "مساح", en: "Draftsman" },
  ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  HR: { ar: "موارد بشرية", en: "HR" },
  SECRETARY: { ar: "سكرتارية", en: "Secretary" },
  VIEWER: { ar: "مشاهد", en: "Viewer" },
};

export const actionLabels: Record<string, { ar: string; en: string }> = {
  CREATE: { ar: "إنشاء", en: "Create" },
  UPDATE: { ar: "تحديث", en: "Update" },
  DELETE: { ar: "حذف", en: "Delete" },
  APPROVE: { ar: "موافقة", en: "Approve" },
  REJECT: { ar: "رفض", en: "Reject" },
  login: { ar: "تسجيل دخول", en: "Login" },
};

export const entityLabels: Record<string, { ar: string; en: string }> = {
  project: { ar: "مشروع", en: "Project" },
  task: { ar: "مهمة", en: "Task" },
  invoice: { ar: "فاتورة", en: "Invoice" },
  contract: { ar: "عقد", en: "Contract" },
  client: { ar: "عميل", en: "Client" },
  employee: { ar: "موظف", en: "Employee" },
  payment: { ar: "دفعة", en: "Payment" },
  site_visit: { ar: "زيارة موقع", en: "Site Visit" },
  LEAVE: { ar: "إجازة", en: "Leave" },
  document: { ar: "مستند", en: "Document" },
};

const avatarColors = [
  "bg-brand-navy-100 dark:bg-brand-navy-900 text-brand-navy-700 dark:text-brand-navy-300",
  "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
  "bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300",
  "bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300",
  "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300",
];

export function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function formatTime(dateStr: string, isAr: boolean) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ${isAr ? "أيام" : "d"}`;
  if (hours > 0) return `${hours} ${isAr ? "ساعات" : "h"}`;
  return isAr ? "الآن" : "Now";
}
