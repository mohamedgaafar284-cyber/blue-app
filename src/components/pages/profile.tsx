"use client";


import { useTranslations } from 'next-intl';
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  User, Building2, Calendar, Shield, Key,
  Globe, Moon, Sun, Camera, Save, Eye, EyeOff, Loader2, Trash2,
  Download, AlertTriangle,
} from "lucide-react";
import { getMutationHeaders, getCsrfToken } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string;
  phone: string;
  department: string;
  position: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export default function ProfilePage({ language }: { language: "ar" | "en" }) {
  const tAuto = useTranslations();
  const isAr = language === "ar";
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile query
  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  // Form state for editing - initialize from auth store (available immediately)
  const [profileForm, setProfileForm] = useState(() => ({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    department: user?.department || "",
    position: user?.position || "",
  }));

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err.error, "Failed to update profile"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      updateUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: tAuto('auto.success'),
        description: tAuto('auto.profileUpdatedSuccessfully'),
        variant: "success",
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: tAuto('auto.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordForm) => {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err.error, "Failed to change password"));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: tAuto('auto.success'),
        description: tAuto('auto.passwordChangedSuccessfully'),
        variant: "success",
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: Error) => {
      toast({
        title: tAuto('auto.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload avatar mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { 'X-CSRF-Token': getCsrfToken() },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err.error, "Failed to upload avatar"));
      }
      return res.json();
    },
    onSuccess: (data) => {
      updateUser({ avatar: data.avatar });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: tAuto('auto.success'),
        description: tAuto('auto.avatarUpdatedSuccessfully'),
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: tAuto('auto.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete avatar mutation
  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/profile/avatar", { method: "DELETE", headers: getMutationHeaders() });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err.error, "Failed to delete avatar"));
      }
      return res.json();
    },
    onSuccess: () => {
      updateUser({ avatar: "" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: tAuto('auto.success'),
        description: tAuto('auto.avatarDeletedSuccessfully'),
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: tAuto('auto.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const handleChangePassword = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: tAuto('auto.error'),
        description: tAuto('auto.passwordsDoNotMatch'),
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({
        title: tAuto('auto.error'),
        description: tAuto('auto.passwordTooShort'),
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate(passwordForm);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: tAuto('auto.error'),
        description: tAuto('auto.fileTypeNotSupported'),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: tAuto('auto.error'),
        description: tAuto('auto.fileTooLarge'),
        variant: "destructive",
      });
      return;
    }

    uploadAvatarMutation.mutate(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteAvatar = () => {
    deleteAvatarMutation.mutate();
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/profile/export-data");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(extractErrorMessage(err.error, tAuto('auto.failedToExportData')));
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blueprint-data-${user?.id || "export"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: tAuto('auto.success'),
        description: tAuto('auto.yourDataWasExportedSuccessfully'),
        variant: "success",
      });
      setShowExportDialog(false);
    } catch (error) {
      toast({
        title: tAuto('auto.error'),
        description: error instanceof Error ? error.message : (tAuto('auto.anErrorOccurredDuringExport')),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roles: Record<string, { labelAr: string; labelEn: string; color: string }> = {
      admin: { labelAr: "مدير النظام", labelEn: "Admin", color: "bg-red-500" },
      MANAGER: { labelAr: "المدير", labelEn: "Manager", color: "bg-brand-navy-500" },
      project_manager: { labelAr: "مدير مشاريع", labelEn: "PM", color: "bg-cyan-500" },
      engineer: { labelAr: "مهندس", labelEn: "Engineer", color: "bg-sky-500" },
      draftsman: { labelAr: "مساح", labelEn: "Draftsman", color: "bg-violet-500" },
      accountant: { labelAr: "محاسب", labelEn: "Accountant", color: "bg-emerald-500" },
      hr: { labelAr: "موارد بشرية", labelEn: "HR", color: "bg-purple-500" },
      secretary: { labelAr: "سكرتارية", labelEn: "Secretary", color: "bg-amber-500" },
      VIEWER: { labelAr: "مشاهد", labelEn: "Viewer", color: "bg-slate-500" },
    };
    const roleConfig = roles[role] || roles.viewer;
    return (
      <Badge className={`${roleConfig.color} text-white`}>
        {isAr ? roleConfig.labelAr : roleConfig.labelEn}
      </Badge>
    );
  };

  const isSaving = updateProfileMutation.isPending;
  const isChangingPassword = changePasswordMutation.isPending;
  const isUploadingAvatar = uploadAvatarMutation.isPending;

  const profileUser = profileData || user;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {tAuto('auto.profile')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {tAuto('auto.manageYourAccountInformation')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800">
            <User className="w-4 h-4 me-2" />
            {tAuto('auto.personalInfo')}
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800">
            <Shield className="w-4 h-4 me-2" />
            {tAuto('auto.security')}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800">
            <Globe className="w-4 h-4 me-2" />
            {tAuto('auto.preferences')}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Avatar Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24 border-4 border-slate-200 dark:border-slate-700">
                    <AvatarImage src={profileUser?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-brand-navy-500 to-brand-navy-600 text-white text-2xl">
                      {profileUser?.name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    className="absolute bottom-0 end-0 rounded-full bg-brand-navy-500 hover:bg-brand-navy-600 w-8 h-8 shadow-md"
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    aria-label={tAuto('auto.changeAvatar')}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="text-center md:text-start flex-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {profileUser?.name || (tAuto('auto.user'))}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400">{profileUser?.email}</p>
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                    {getRoleBadge(profileUser?.role || "VIEWER")}
                    {profileUser?.isActive && (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                        {tAuto('auto.active')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {profileUser?.avatar && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={handleDeleteAvatar}
                      disabled={isUploadingAvatar}
                      aria-label={tAuto('auto.deleteAvatar')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="border-slate-200 dark:border-slate-700"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing
                      ? (tAuto('auto.cancel'))
                      : (tAuto('auto.edit'))}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Info */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">
                {tAuto('auto.personalInformation')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {tAuto('auto.updateYourPersonalInformation')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.fullName')}
                  </Label>
                  <Input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.email')}
                  </Label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.phone')}
                  </Label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.jobTitle')}
                  </Label>
                  <Input
                    value={profileForm.position}
                    onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.department')}
                  </Label>
                  <Input
                    value={profileForm.department}
                    onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                    disabled={!isEditing}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>
            </CardContent>
            {isEditing && (
              <CardFooter className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <Button
                  onClick={handleSaveProfile}
                  className="bg-brand-navy-500 hover:bg-brand-navy-600 text-white"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 me-2" />
                  )}
                  {isSaving
                    ? (tAuto('auto.saving'))
                    : (tAuto('auto.saveChanges'))}
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Work Info */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">
                {tAuto('auto.workInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Building2 className="w-5 h-5 text-brand-navy-500" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tAuto('auto.organization')}
                    </p>
                    <p className="text-slate-900 dark:text-white font-medium">
                      BluePrint Engineering
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tAuto('auto.joinDate')}
                    </p>
                    <p className="text-slate-900 dark:text-white font-medium">
                      {profileData?.createdAt
                        ? new Date(profileData.createdAt).toLocaleDateString(isAr ? "ar-AE" : "en-US")
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Calendar className="w-5 h-5 text-violet-500" />
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tAuto('auto.lastLogin')}
                    </p>
                    <p className="text-slate-900 dark:text-white font-medium">
                      {profileData?.lastLogin
                        ? new Date(profileData.lastLogin).toLocaleDateString(isAr ? "ar-AE" : "en-US")
                        : (tAuto('auto.today'))}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          {/* Export My Data Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">
                {tAuto('auto.exportMyData')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {tAuto('auto.downloadACopyOfAllYourPersonalData')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-brand-navy-500" />
                  <div>
                    <p className="text-slate-900 dark:text-white font-medium">
                      {tAuto('auto.downloadMyData')}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tAuto('auto.jSONFileContainingAllYourData')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-brand-navy-500/30 text-brand-navy-600 dark:text-brand-navy-400 hover:bg-brand-navy-500/10"
                  onClick={() => setShowExportDialog(true)}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 me-2" />
                  )}
                  {isExporting
                    ? (tAuto('auto.exporting'))
                    : (tAuto('auto.export'))}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Export Confirmation Dialog */}
          <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
            <DialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-white">
                  {tAuto('auto.confirmDataExport')}
                </DialogTitle>
                <DialogDescription className="text-slate-500 dark:text-slate-400">
                  {tAuto('auto.aJSONFileContainingAllYourDataWillBeDown')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {tAuto('auto.importantKeepYourDataFileSecure')}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      {tAuto('auto.thisFileContainsSensitiveInformationDoNo')}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {tAuto('auto.dataIncluded')}
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{tAuto('auto.profileNameEmailPhoneRole')}</li>
                    <li>{tAuto('auto.projectsYouCreatedOrAreAssignedTo')}</li>
                    <li>{tAuto('auto.tasksAssignedToYou')}</li>
                    <li>{tAuto('auto.invoicesYouCreated')}</li>
                    <li>{tAuto('auto.documentsYouUploaded')}</li>
                    <li>{tAuto('auto.activityLog1')}</li>
                    <li>{tAuto('auto.notifications')}</li>
                  </ul>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowExportDialog(false)}
                  className="border-slate-200 dark:border-slate-700"
                  disabled={isExporting}
                >
                  {tAuto('auto.cancel')}
                </Button>
                <Button
                  onClick={handleExportData}
                  className="bg-brand-navy-500 hover:bg-brand-navy-600 text-white"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 me-2" />
                  )}
                  {isExporting
                    ? (tAuto('auto.exporting'))
                    : (tAuto('auto.exportData'))}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">
                {tAuto('auto.changePassword')}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                {tAuto('auto.updateYourPassword')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">
                  {tAuto('auto.currentPassword')}
                </Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pe-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute end-0 top-0 h-full text-slate-400 hover:text-slate-600"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={tAuto('auto.togglePasswordVisibility')}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.newPassword')}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pe-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute end-0 top-0 h-full text-slate-400 hover:text-slate-600"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={tAuto('auto.togglePasswordVisibility')}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    {tAuto('auto.confirmPassword')}
                  </Label>
                  <Input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {tAuto('auto.passwordMustBeAtLeast6Characters')}
              </p>
            </CardContent>
            <CardFooter className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <Button
                onClick={handleChangePassword}
                className="bg-brand-navy-500 hover:bg-brand-navy-600 text-white"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : (
                  <Key className="w-4 h-4 me-2" />
                )}
                {isChangingPassword
                  ? (tAuto('auto.changing'))
                  : (tAuto('auto.changePassword'))}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">
                {tAuto('auto.preferences')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-brand-navy-500" />
                  <div>
                    <p className="text-slate-900 dark:text-white font-medium">
                      {tAuto('auto.language')}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tAuto('auto.chooseInterfaceLanguage')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={isAr ? "default" : "outline"}
                    size="sm"
                    className={isAr ? "bg-brand-navy-500 hover:bg-brand-navy-600 text-white" : "border-slate-200 dark:border-slate-700"}
                    disabled
                  >
                    العربية
                  </Button>
                  <Button
                    variant={!isAr ? "default" : "outline"}
                    size="sm"
                    className={!isAr ? "bg-brand-navy-500 hover:bg-brand-navy-600 text-white" : "border-slate-200 dark:border-slate-700"}
                    disabled
                  >
                    English
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="w-5 h-5 text-violet-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-400" />
                  )}
                  <div>
                    <p className="text-slate-900 dark:text-white font-medium">
                      {tAuto('auto.theme')}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {tAuto('auto.chooseAppAppearance')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className={theme === "light" ? "bg-brand-navy-500 hover:bg-brand-navy-600 text-white" : "border-slate-200 dark:border-slate-700"}
                  >
                    <Sun className="w-4 h-4 me-1" />
                    {tAuto('auto.light')}
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className={theme === "dark" ? "bg-brand-navy-500 hover:bg-brand-navy-600 text-white" : "border-slate-200 dark:border-slate-700"}
                  >
                    <Moon className="w-4 h-4 me-1" />
                    {tAuto('auto.dark')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
