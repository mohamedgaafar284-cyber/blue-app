"use client";


import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, KeyRound } from "lucide-react";
import { getMutationHeaders } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import { useToast } from "@/hooks/use-toast";
import { type NewUserData, roleLabels } from "./types";
import { TempPasswordDialog } from "./temp-password-dialog";

interface UserFormProps {
  isAr: boolean;
  addUserOpen: boolean;
  setAddUserOpen: (open: boolean) => void;
  newUser: NewUserData;
  setNewUser: (user: NewUserData) => void;
  onSuccess: () => void;
}

export function UserForm({
  isAr,
  addUserOpen,
  setAddUserOpen,
  newUser,
  setNewUser,
  onSuccess,
}: UserFormProps) {
  const tAuto = useTranslations();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordUser, setTempPasswordUser] = useState({ name: "", email: "" });

  const createUserMutation = useMutation({
    mutationFn: (data: NewUserData) =>
      fetch("/api/users", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          ...data,
          // Empty optional password → server generates a temp password and
          // returns it once (shown in TempPasswordDialog)
          password: data.password?.trim() ? data.password.trim() : undefined,
        }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({
          title: tAuto('auto.error'),
          description: extractErrorMessage(data.error, tAuto('auto.anErrorOccurred')),
          variant: "destructive",
        });
        return;
      }
      // One-time temp password display — BEFORE anything else gets closed
      if (data.temporaryPassword) {
        setTempPassword(data.temporaryPassword);
        setTempPasswordUser({ name: data.name || newUser.name, email: data.email || newUser.email });
      } else {
        toast({
          title: isAr ? "تم إنشاء المستخدم" : "User created",
          description: isAr ? "أُضيف المستخدم بنجاح." : "User added successfully.",
        });
      }
      onSuccess();
      setAddUserOpen(false);
      setNewUser({ name: "", email: "", role: "VIEWER", department: "", position: "", phone: "", password: "" });
    },
  });

  return (
    <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
      <DialogTrigger asChild>
        <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white gap-1.5 h-9 rounded-lg shadow-sm shadow-brand-navy-500/20">
          <UserPlus className="h-4 w-4" />
          {tAuto('auto.addUser')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{tAuto('auto.addNewUser')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{tAuto('auto.name')}</Label>
            <Input
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder={tAuto('auto.ahmedMohamed')}
              className="h-10 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{tAuto('auto.email')}</Label>
            <Input
              type="email"
              dir="ltr"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="user@blueprint.ae"
              className="h-10 rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? "كلمة المرور (اختياري)" : "Password (optional)"}
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                dir="ltr"
                value={newUser.password || ""}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder={isAr ? "اتركها فارغة للتوليد التلقائي" : "Leave empty to auto-generate"}
                className="h-10 rounded-lg pe-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <KeyRound className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {isAr
                ? "لو سبتها فاضية هيولّد النظام كلمة مرور مؤقتة قوية ويعرضها لك مرة واحدة تعطيها للموظف."
                : "If left empty, the system generates a strong temporary password and shows it to you once to hand to the employee."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{tAuto('auto.role')}</Label>
              <Select
                value={newUser.role}
                onValueChange={(v) => setNewUser({ ...newUser, role: v })}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {isAr ? label.ar : label.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{tAuto('auto.department')}</Label>
              <Input
                value={newUser.department}
                onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                placeholder={tAuto('auto.engineering')}
                className="h-10 rounded-lg"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{tAuto('auto.position')}</Label>
            <Input
              value={newUser.position}
              onChange={(e) => setNewUser({ ...newUser, position: e.target.value })}
              placeholder={tAuto('auto.seniorEngineer')}
              className="h-10 rounded-lg"
            />
          </div>
          <Button
            onClick={() => createUserMutation.mutate(newUser)}
            disabled={createUserMutation.isPending || !newUser.name || !newUser.email}
            className="w-full bg-brand-navy-600 hover:bg-brand-navy-700 text-white h-10 rounded-lg shadow-sm shadow-brand-navy-500/20"
          >
            {tAuto('auto.addUser')}
          </Button>
        </div>
      </DialogContent>

      {/* One-time temporary password display (auto-generated password) */}
      <TempPasswordDialog
        isAr={isAr}
        open={!!tempPassword}
        onClose={() => setTempPassword(null)}
        password={tempPassword || ""}
        userName={tempPasswordUser.name}
        userEmail={tempPasswordUser.email}
      />
    </Dialog>
  );
}
