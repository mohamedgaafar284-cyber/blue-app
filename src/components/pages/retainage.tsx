"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
// Badge available for future use
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getMutationHeaders } from "@/lib/csrf-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  ShieldCheck,
  Inbox,
  ArrowRightLeft,
  Lock,
  Unlock,
} from "lucide-react";

// ===== Types =====
interface RetainageItem {
  id: string;
  organizationId: string | null;
  projectId: string;
  invoiceId: string | null;
  percentage: number;
  retainedAmount: number;
  releaseDate: string | null;
  status: string;
  releasedAmount: number;
  releasedDate: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; nameEn: string; number: string };
}

interface ProjectOption {
  id: string;
  name: string;
  nameEn: string;
  number: string;
}

// ===== Helpers =====
function getStatusConfig(status: string) {
  const configs: Record<string, { ar: string; en: string; color: string }> = {
    HELD: {
      ar: "محتجز", en: "Held",
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    },
    PARTIALLY_RELEASED: {
      ar: "مُفرج جزئياً", en: "Partially Released",
      color: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
    },
    RELEASED: {
      ar: "مُفرج", en: "Released",
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    },
  };
  return configs[status] || configs.HELD;
}

// ===== Main Component =====
interface RetainagePageProps {
  language: "ar" | "en";
  projectId?: string;
}

export default function RetainagePage({ language, projectId }: RetainagePageProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>(projectId || "all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState<RetainageItem | null>(null);
  const [releaseAmount, setReleaseAmount] = useState("");
  const [isFullRelease, setIsFullRelease] = useState(false);

  const emptyForm = {
    projectId: projectId || "",
    invoiceId: "",
    percentage: "5",
    retainedAmount: "0",
    releaseDate: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  // Fetch retainages
  const { data: retainages = [], isLoading } = useQuery<RetainageItem[]>({
    queryKey: ["retainages", filterProject],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterProject && filterProject !== "all") params.set("projectId", filterProject);
      if (filterStatus && filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/retainage?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json(); return json.data || json;
    },
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const res = await fetch("/api/projects-simple");
      if (!res.ok) return [];
      const json = await res.json(); return json.data || json;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/retainage", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retainages"] });
      setShowAddDialog(false);
      setFormData(emptyForm);
    },
  });

  // Release mutation
  const releaseMutation = useMutation({
    mutationFn: async ({ id, releasedAmount, isFullRelease }: { id: string; releasedAmount: string; isFullRelease: boolean }) => {
      const res = await fetch(`/api/retainage/${id}`, {
        method: "PATCH",
        headers: getMutationHeaders(),
        body: JSON.stringify({ releasedAmount, isFullRelease }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retainages"] });
      setShowReleaseDialog(null);
      setReleaseAmount("");
      setIsFullRelease(false);
    },
  });

  // Filter
  const filtered = retainages.filter((r) => {
    const matchSearch = (ar ? r.project.name : r.project.nameEn || r.project.name)
      .toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Summary
  const totalRetained = filtered.reduce((s, r) => s + Number(r.retainedAmount), 0);
  const totalReleased = filtered.reduce((s, r) => s + Number(r.releasedAmount), 0);
  const pendingRelease = totalRetained - totalReleased;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="py-0 gap-0"><div className="p-4"><Skeleton className="h-20 w-full" /></div></Card>
          ))}
        </div>
        <Card><div className="p-4"><Skeleton className="h-64 w-full" /></div></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ShieldCheck className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tAuto('auto.retainageManagement')}</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {tAuto('auto.trackRetainedAmountsUntilProjectCompleti')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ms-auto">
          <Button size="sm" className="h-8 bg-brand-navy-600 hover:bg-brand-navy-700 text-white rounded-lg shadow-sm shadow-brand-navy-600/20" onClick={() => { setFormData(emptyForm); setShowAddDialog(true); }}>
            <Plus className="h-3.5 w-3.5 me-1" />{tAuto('auto.newRetainage')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /></div>
              <span className="text-xs text-amber-600 dark:text-amber-400">{tAuto('auto.totalRetained')}</span>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">{formatCurrency(totalRetained, ar)}</div>
          </div>
        </Card>
        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><Unlock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">{tAuto('auto.released')}</span>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">{formatCurrency(totalReleased, ar)}</div>
          </div>
        </Card>
        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/20 dark:to-sky-800/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><ArrowRightLeft className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /></div>
              <span className="text-xs text-sky-600 dark:text-sky-400">{tAuto('auto.pendingRelease')}</span>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">{formatCurrency(pendingRelease, ar)}</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tAuto('auto.search1')} className="ps-9 h-8 text-sm rounded-lg" />
        </div>
        {!projectId && (
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px] h-8 text-xs rounded-lg"><SelectValue placeholder={tAuto('auto.project')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.allProjects')}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-8 text-xs rounded-lg"><SelectValue placeholder={tAuto('auto.status1')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tAuto('auto.all')}</SelectItem>
            <SelectItem value="HELD">{tAuto('auto.held')}</SelectItem>
            <SelectItem value="PARTIALLY_RELEASED">{tAuto('auto.partiallyReleased')}</SelectItem>
            <SelectItem value="RELEASED">{tAuto('auto.released')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-slate-50/80 dark:bg-slate-800/50">
              <TableHead className="text-xs font-semibold">{tAuto('auto.project')}</TableHead>
              <TableHead className="text-xs font-semibold">{ar ? "النسبة %" : "%"}</TableHead>
              <TableHead className="text-xs font-semibold">{tAuto('auto.retained')}</TableHead>
              <TableHead className="text-xs font-semibold hidden md:table-cell">{tAuto('auto.released')}</TableHead>
              <TableHead className="text-xs font-semibold hidden sm:table-cell">{tAuto('auto.status1')}</TableHead>
              <TableHead className="text-xs font-semibold hidden lg:table-cell">{tAuto('auto.releaseDate')}</TableHead>
              <TableHead className="text-xs font-semibold text-start">{tAuto('auto.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item, idx) => {
              const statusCfg = getStatusConfig(item.status);
              const remaining = Number(item.retainedAmount) - Number(item.releasedAmount);
              return (
                <TableRow key={item.id} className={cn(
                  "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                  idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/20",
                )}>
                  <TableCell className="font-medium text-slate-900 dark:text-white text-xs">
                    {ar ? item.project?.name : item.project?.nameEn || item.project?.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">{Number(item.percentage)}%</TableCell>
                  <TableCell className="font-mono text-xs text-slate-900 dark:text-white tabular-nums">{formatCurrency(Number(item.retainedAmount), ar)}</TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(Number(item.releasedAmount), ar)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium", statusCfg.color)}>
                      {ar ? statusCfg.ar : statusCfg.en}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-500">
                    {item.releasedDate ? formatDate(item.releasedDate, ar) : item.releaseDate ? formatDate(item.releaseDate, ar) : "—"}
                  </TableCell>
                  <TableCell className="text-start">
                    {item.status !== "RELEASED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-brand-navy-600 hover:text-brand-navy-700 hover:bg-brand-navy-50 dark:hover:bg-brand-navy-950/30"
                        onClick={() => {
                          setShowReleaseDialog(item);
                          setReleaseAmount(String(remaining));
                          setIsFullRelease(false);
                        }}
                      >
                        <Unlock className="h-3 w-3 me-1" />
                        {tAuto('auto.release')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Inbox className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{tAuto('auto.noRetainagesFound')}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tAuto('auto.newRetainage')}</DialogTitle>
            <DialogDescription>{tAuto('auto.addANewRetainageForTheProject')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.project')} *</Label>
              <Select value={formData.projectId} onValueChange={(v) => setFormData({ ...formData, projectId: v })}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.percentage')}</Label>
                <Input type="number" value={formData.percentage} onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} className="h-8 text-sm rounded-lg" placeholder="5" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.retainedAmount')}</Label>
                <Input type="number" value={formData.retainedAmount} onChange={(e) => setFormData({ ...formData, retainedAmount: e.target.value })} className="h-8 text-sm font-mono rounded-lg" placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.invoiceID')}</Label>
              <Input value={formData.invoiceId} onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })} className="h-8 text-sm rounded-lg" placeholder={tAuto('auto.optional')} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.expectedReleaseDate')}</Label>
              <Input type="date" value={formData.releaseDate} onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })} className="h-8 text-sm rounded-lg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setShowAddDialog(false)}>{tAuto('auto.cancel')}</Button>
            <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white rounded-lg" disabled={createMutation.isPending} onClick={() => createMutation.mutate(formData)}>
              {createMutation.isPending ? (tAuto('auto.saving')) : (tAuto('auto.save'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Dialog */}
      <Dialog open={!!showReleaseDialog} onOpenChange={(open) => { if (!open) setShowReleaseDialog(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tAuto('auto.releaseRetainage')}</DialogTitle>
            <DialogDescription>
              {showReleaseDialog && `${tAuto('auto.remaining')}: ${formatCurrency(Number(showReleaseDialog.retainedAmount) - Number(showReleaseDialog.releasedAmount), ar)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={isFullRelease} onChange={(e) => setIsFullRelease(e.target.checked)} className="rounded" />
                {tAuto('auto.fullRelease')}
              </label>
            </div>
            {!isFullRelease && (
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.releaseAmount')}</Label>
                <Input type="number" value={releaseAmount} onChange={(e) => setReleaseAmount(e.target.value)} className="h-8 text-sm font-mono rounded-lg" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setShowReleaseDialog(null)}>{tAuto('auto.cancel')}</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" disabled={releaseMutation.isPending} onClick={() => {
              if (showReleaseDialog) {
                releaseMutation.mutate({ id: showReleaseDialog.id, releasedAmount: releaseAmount, isFullRelease });
              }
            }}>
              {releaseMutation.isPending ? (tAuto('auto.releasing')) : (tAuto('auto.release'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
