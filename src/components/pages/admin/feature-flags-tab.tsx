"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { getMutationHeaders } from "@/lib/csrf-client";
import { Flag, Plus, Pencil, Loader2 } from "lucide-react";

interface FeatureFlagRecord {
  id: string;
  key: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  enabled: boolean;
  enabledForOrgs: string | null;
  enabledForRoles: string | null;
  percentage: number;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FeatureFlagsTabProps {
  isAr: boolean;
}

export default function FeatureFlagsTab({ isAr }: FeatureFlagsTabProps) {
  const tAuto = useTranslations();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlagRecord | null>(null);
  const [form, setForm] = useState({
    key: "",
    name: "",
    nameAr: "",
    description: "",
    descriptionAr: "",
    enabled: false,
    enabledForOrgs: "",
    enabledForRoles: "",
    percentage: 100,
  });

  // Fetch flags
  const { data: flagsData = [], isLoading } = useQuery<FeatureFlagRecord[]>({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/feature-flags");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
  });

  // Toggle flag mutation
  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      fetch("/api/feature-flags", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ key, enabled }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
  });

  // Create/update flag mutation
  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetch("/api/feature-flags", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      setEditOpen(false);
      setEditingFlag(null);
    },
  });

  const openCreate = () => {
    setEditingFlag(null);
    setForm({
      key: "",
      name: "",
      nameAr: "",
      description: "",
      descriptionAr: "",
      enabled: false,
      enabledForOrgs: "",
      enabledForRoles: "",
      percentage: 100,
    });
    setEditOpen(true);
  };

  const openEdit = (flag: FeatureFlagRecord) => {
    setEditingFlag(flag);
    setForm({
      key: flag.key,
      name: flag.name,
      nameAr: flag.nameAr || "",
      description: flag.description || "",
      descriptionAr: flag.descriptionAr || "",
      enabled: flag.enabled,
      enabledForOrgs: flag.enabledForOrgs || "",
      enabledForRoles: flag.enabledForRoles || "",
      percentage: flag.percentage,
    });
    setEditOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const parseJsonList = (val: string | null): string[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <TabsContent value="flags" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-[#133371]" />
          <h3 className="text-lg font-semibold">
            {tAuto('auto.featureFlags')}
          </h3>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-[#133371] hover:bg-[#0f2855] text-white">
          <Plus className="h-3.5 w-3.5" />
          {tAuto('auto.addFlag')}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : flagsData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{tAuto('auto.noFeatureFlagsYet')}</p>
          <p className="text-sm">
            {tAuto('auto.createAFeatureFlagToControlFeatureAvaila')}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tAuto('auto.key')}</TableHead>
                <TableHead>{tAuto('auto.name')}</TableHead>
                <TableHead className="text-center">{tAuto('auto.enabled')}</TableHead>
                <TableHead className="text-center">{tAuto('auto.pct')}</TableHead>
                <TableHead>{tAuto('auto.targeting')}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagsData.map((flag) => {
                const orgs = parseJsonList(flag.enabledForOrgs);
                const roles = parseJsonList(flag.enabledForRoles);
                return (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {flag.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {isAr && flag.nameAr ? flag.nameAr : flag.name}
                      </div>
                      {(flag.description || flag.descriptionAr) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {isAr && flag.descriptionAr ? flag.descriptionAr : flag.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ key: flag.key, enabled: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={flag.percentage < 100 ? "outline" : "secondary"} className="text-xs">
                        {flag.percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {orgs.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {isAr ? `${orgs.length} مؤسسات` : `${orgs.length} orgs`}
                          </Badge>
                        )}
                        {roles.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {isAr ? `${roles.length} أدوار` : `${roles.length} roles`}
                          </Badge>
                        )}
                        {orgs.length === 0 && roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            {tAuto('auto.all')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(flag)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingFlag
                ? tAuto('auto.editFeatureFlag')
                : tAuto('auto.createFeatureFlag')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Key */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {tAuto('auto.key')}
              </Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                placeholder="e.g., google_login"
                disabled={!!editingFlag}
              />
              <p className="text-xs text-muted-foreground">
                {tAuto('auto.lowercaseUnderscoresHyphensOnly')}
              </p>
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {tAuto('auto.nameEnglish')} *
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={tAuto('auto.googleLogin')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {tAuto('auto.nameArabic')}
                </Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="تسجيل دخول جوجل"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {tAuto('auto.descriptionEnglish')}
                </Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={tAuto('auto.enableGoogleOAuthLogin')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">
                  {tAuto('auto.descriptionArabic')}
                </Label>
                <Input
                  value={form.descriptionAr}
                  onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                  placeholder="تفعيل تسجيل الدخول عبر جوجل"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">
                {tAuto('auto.enabled')}
              </Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
              />
            </div>

            {/* Percentage */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {tAuto('auto.rolloutPercentage')} ({form.percentage}%)
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: parseInt(e.target.value) || 100 })}
              />
              <p className="text-xs text-muted-foreground">
                {tAuto('auto.percentageOfUsersToEnableThisFeatureFor')}
              </p>
            </div>

            {/* Enabled for Orgs */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {tAuto('auto.enabledForOrgsJSON')}
              </Label>
              <Input
                value={form.enabledForOrgs}
                onChange={(e) => setForm({ ...form, enabledForOrgs: e.target.value })}
                placeholder='["org_id_1", "org_id_2"]'
              />
              <p className="text-xs text-muted-foreground">
                {tAuto('auto.leaveEmptyForAllOrganizations')}
              </p>
            </div>

            {/* Enabled for Roles */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                {tAuto('auto.enabledForRolesJSON')}
              </Label>
              <Input
                value={form.enabledForRoles}
                onChange={(e) => setForm({ ...form, enabledForRoles: e.target.value })}
                placeholder='["ADMIN", "MANAGER"]'
              />
              <p className="text-xs text-muted-foreground">
                {tAuto('auto.leaveEmptyForAllRoles')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              {tAuto('auto.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !form.key || !form.name}
              className="bg-[#133371] hover:bg-[#0f2855] text-white"
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editingFlag ? (tAuto('auto.update')) : (tAuto('auto.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
