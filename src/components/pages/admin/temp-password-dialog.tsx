"use client";

/**
 * TempPasswordDialog — نافذة كلمة المرور المؤقتة (تُعرض مرة واحدة)
 *
 * Shown after the admin creates a user WITHOUT a password (the system
 * generated one) or resets a user's password. The plaintext is displayed
 * exactly once with a copy button and a strong warning — it is never
 * stored in plaintext anywhere and never emailed (production has no
 * guaranteed SMTP). The admin hands it to the employee directly.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, KeyRound, AlertTriangle } from "lucide-react";

interface TempPasswordDialogProps {
  isAr: boolean;
  open: boolean;
  onClose: () => void;
  password: string;
  userName: string;
  userEmail: string;
}

export function TempPasswordDialog({
  isAr,
  open,
  onClose,
  password,
  userName,
  userEmail,
}: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers: fallback via hidden textarea
      const textarea = document.createElement("textarea");
      textarea.value = password;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore — user can select the input manually */
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-navy-600" />
            {isAr ? "كلمة المرور المؤقتة" : "Temporary Password"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? `للمستخدم: ${userName} (${userEmail})`
              : `For user: ${userName} (${userEmail})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex gap-2">
            <Input
              value={password}
              readOnly
              dir="ltr"
              className="font-mono text-base tracking-wider select-all"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button type="button" variant="outline" size="icon" onClick={copy} className="h-10 w-10 shrink-0">
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              {isAr
                ? "⚠️ هذه الكلمة تُعرض مرة واحدة فقط — لن يتم إرسالها بالبريد ولن تظهر مرة أخرى. انسخها الآن وسلّمها للموظف، واطلب منه تغييرها فور أول تسجيل دخول من الملف الشخصي."
                : "⚠️ Shown ONCE only — it will not be emailed and will not appear again. Copy it now, hand it to the employee, and ask them to change it at first login from their profile."}
            </AlertDescription>
          </Alert>

          <Button className="w-full" onClick={onClose}>
            {isAr ? "نسخته — تم" : "Copied — Done"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
