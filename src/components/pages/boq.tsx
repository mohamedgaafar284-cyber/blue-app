"use client";


import { useTranslations } from 'next-intl';
/**
 * BOQ (Bill of Quantities) Page
 * صفحة جدول الكميات
 */

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Calculator, Plus, Search, Edit, Trash2, FileSpreadsheet, DollarSign, Package, Download, Save, Loader2, Building2 } from 'lucide-react'

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { getMutationHeaders } from "@/lib/csrf-client";

// ===== BOQ Categories =====
const BOQ_CATEGORIES = [
  { value: "CIVIL", label: "أعمال مدنية", labelEn: "Civil Works" },
  { value: "STRUCTURAL", label: "أعمال إنشائية", labelEn: "Structural Works" },
  { value: "MEP", label: "أعمال ميكانيكية وكهربائية", labelEn: "MEP Works" },
  { value: "FINISHING", label: "أعمال تشطيبات", labelEn: "Finishing Works" },
  { value: "EXTERNAL", label: "أعمال خارجية", labelEn: "External Works" },
  { value: "infrastructure", label: "أعمال بنية تحتية", labelEn: "Infrastructure" },
];

const BOQ_UNITS = [
  { value: "م²", label: "م²" },
  { value: "م³", label: "م³" },
  { value: "م", label: "م" },
  { value: "طن", label: "طن" },
  { value: "كجم", label: "كجم" },
  { value: "قطعة", label: "قطعة" },
  { value: "م.طولي", label: "م.طولي" },
  { value: "لتر", label: "لتر" },
  { value: "مجموعة", label: "مجموعة" },
];

// ===== Types =====
interface BOQItem {
  id: string;
  projectId: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

interface Project {
  id: string;
  name: string;
}

// ===== Helpers =====

function getCategoryLabel(category: string, ar: boolean) {
  const cat = BOQ_CATEGORIES.find((c) => c.value === category);
  return cat ? (ar ? cat.label : cat.labelEn) : category;
}

function getCategoryColor(category: string) {
  const colors: Record<string, string> = {
    CIVIL: "bg-brand-navy-100 text-brand-navy-700 dark:bg-brand-navy-900/40 dark:text-brand-navy-300",
    STRUCTURAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    MEP: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    FINISHING: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    EXTERNAL: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    infrastructure: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
  return colors[category] || colors.civil;
}

// ===== Main Component =====
interface BOQPageProps {
  language: "ar" | "en";
  projectId?: string;
}

export default function BOQPage({ language, projectId }: BOQPageProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const toast = useToastFeedback({ ar });

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState(projectId || "all");
  const [_categoryFilter, _setCategoryFilter] = useState("all");
  const [activeCategoryTab, setActiveCategoryTab] = useState("all");

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BOQItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    unit: "",
    quantity: 0,
    unitPrice: 0,
    category: "CIVIL",
    projectId: "",
  });

  // Fetch projects
  const { data: projectsData } = useQuery<Project[]>({
    queryKey: ["projects-simple-boq"],
    queryFn: async () => {
      const res = await fetch("/api/projects-simple");
      if (!res.ok) return [];
      const json = await res.json(); return json.data || json;
    },
  });
  const projects = projectsData || [];

  // Fetch BOQ items
  const { data: boqResponse, isLoading } = useQuery<{ success: boolean; data: BOQItem[]; summary: { total: number; itemCount: number; byCategory: Record<string, { count: number; total: number }> } }>({
    queryKey: ["boq-items", projectFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectFilter !== "all") params.set("projectId", projectFilter);
      const res = await fetch(`/api/boq?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json(); return json.data || json;
    },
  });
  const boqItems = useMemo(() => boqResponse?.data || [], [boqResponse?.data]);
  const boqSummary = boqResponse?.summary;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/boq", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boq-items"] });
      setShowAddDialog(false);
      resetFormData();
      toast.created(tAuto('auto.bOQItem'));
    },
    onError: () => toast.error(tAuto('auto.addItem')),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch("/api/boq", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ id, ...data }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boq-items"] });
      setShowEditDialog(false);
      setSelectedItem(null);
      toast.updated(tAuto('auto.item'));
    },
    onError: () => toast.error(tAuto('auto.updateItem')),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/boq?id=${id}`, { method: "DELETE", headers: getMutationHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boq-items"] });
      setShowDeleteDialog(false);
      setSelectedItem(null);
      toast.deleted(tAuto('auto.item'));
    },
    onError: () => toast.error(tAuto('auto.deleteItem')),
  });

  // Filter items
  const filteredItems = useMemo(() => {
    return boqItems.filter((item) => {
      const matchesSearch =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategoryTab === "all" || item.category === activeCategoryTab;
      return matchesSearch && matchesCategory;
    });
  }, [boqItems, searchQuery, activeCategoryTab]);

  // Category subtotals for filtered items
  const categorySubtotals = useMemo(() => {
    const subtotals: Record<string, number> = {};
    filteredItems.forEach((item) => {
      if (!subtotals[item.category]) subtotals[item.category] = 0;
      subtotals[item.category] += item.total;
    });
    return subtotals;
  }, [filteredItems]);

  const filteredTotal = filteredItems.reduce((sum, item) => sum + Number(item.total), 0);

  // Export to CSV
  const handleExport = () => {
    const headers = ar
      ? ["الرقم", "الوصف", "الفئة", "الوحدة", "الكمية", "سعر الوحدة", "الإجمالي"]
      : ["No.", "Description", "Category", "Unit", "Qty", "Unit Price", "Total"];
    const rows = filteredItems.map((item) => [
      item.code,
      item.description,
      getCategoryLabel(item.category, ar),
      item.unit,
      item.quantity,
      item.unitPrice,
      item.total,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boq-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.showSuccess(tAuto('auto.fileExported'));
  };

  const resetFormData = () => {
    setFormData({ code: "", description: "", unit: "", quantity: 0, unitPrice: 0, category: "CIVIL", projectId: projectId || (projectFilter !== "all" ? projectFilter : "") });
  };

  const openEditDialog = (item: BOQItem) => {
    setSelectedItem(item);
    setFormData({
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      category: item.category,
      projectId: item.projectId,
    });
    setShowEditDialog(true);
  };

  // ===== Loading State =====
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ===== HEADER SECTION ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-navy-500 to-cyan-600 flex items-center justify-center shadow-md shadow-brand-navy-500/20">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {tAuto('auto.billOfQuantities')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tAuto('auto.manageProjectQuantityItems')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={filteredItems.length === 0} className="gap-2 h-9 text-xs">
            <Download className="h-3.5 w-3.5" />
            {tAuto('auto.exportCSV')}
          </Button>
          <Button
            onClick={() => { resetFormData(); setShowAddDialog(true); }}
            className="gap-2 bg-gradient-to-r from-brand-navy-600 to-cyan-600 hover:from-brand-navy-700 hover:to-cyan-700 text-white text-sm shadow-md shadow-brand-navy-500/20 border-0 h-9 px-4"
          >
            <Plus className="h-4 w-4" />
            {tAuto('auto.addItem1')}
          </Button>
        </div>
      </div>

      {/* ===== SUMMARY STAT CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden rounded-xl">
          <div className="bg-gradient-to-br from-brand-navy-500 to-cyan-600 dark:from-brand-navy-600 dark:to-cyan-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{boqSummary?.itemCount ?? 0}</div>
            <p className="text-[11px] text-brand-navy-100 mt-0.5">{tAuto('auto.totalItems')}</p>
          </div>
        </Card>

        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden rounded-xl">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <DollarSign className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums font-mono">{formatCurrency(boqSummary?.total ?? 0, ar)}</div>
            <p className="text-[11px] text-emerald-100 mt-0.5">{tAuto('auto.totalValue')}</p>
          </div>
        </Card>

        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden rounded-xl">
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 dark:from-violet-600 dark:to-violet-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
                <Package className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {boqSummary ? Object.keys(boqSummary.byCategory).length : 0}
            </div>
            <p className="text-[11px] text-violet-100 mt-0.5">{tAuto('auto.categoriesUsed')}</p>
          </div>
        </Card>
      </div>

      {/* ===== FILTERS ===== */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={tAuto('auto.searchByDescriptionOrCode')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-9 text-sm"
            />
          </div>
          {!projectId && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-9 text-sm">
              <SelectValue placeholder={tAuto('auto.project')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.allProjects')}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
        </div>
      </div>

      {/* ===== CATEGORY TABS ===== */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800/60 rounded-xl p-1 gap-0.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveCategoryTab("all")}
          className={cn(
            "px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
            activeCategoryTab === "all"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {tAuto('auto.all')} ({boqItems.length})
        </button>
        {BOQ_CATEGORIES.map((cat) => {
          const count = boqItems.filter((i) => i.category === cat.value).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategoryTab(cat.value)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                activeCategoryTab === cat.value
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              {ar ? cat.label : cat.labelEn} ({count})
            </button>
          );
        })}
      </div>

      {/* ===== BOQ TABLE ===== */}
      <Card className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50">
        <CardContent className="p-0">
          {projectFilter === "all" ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-5">
                <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {tAuto('auto.selectAProject')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                {tAuto('auto.pleaseSelectAProjectFromTheListToViewIts')}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mb-5">
                <FileSpreadsheet className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {tAuto('auto.noItemsFound1')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                {tAuto('auto.noBOQItemsFoundForThisProject')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 border-slate-200 dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-16">{tAuto('auto.no')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tAuto('auto.description')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-32">{tAuto('auto.category')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-20 text-end">{tAuto('auto.unit')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-20 text-end">{tAuto('auto.qty')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-28 text-end">{tAuto('auto.unitPrice')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-28 text-end">{tAuto('auto.total')}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-20 text-center">{tAuto('auto.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, idx) => (
                    <TableRow key={item.id} className={cn("border-slate-100 dark:border-slate-800/50 hover:bg-brand-navy-50/30 dark:hover:bg-brand-navy-900/10 transition-colors", idx % 2 === 1 && "bg-slate-50/50 dark:bg-slate-800/20")}>
                      <TableCell className="text-xs font-mono text-slate-500 dark:text-slate-400">{item.code || "-"}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.description}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", getCategoryColor(item.category))}>
                          {getCategoryLabel(item.category, ar)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-end">{item.unit}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-end tabular-nums">{item.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 text-end font-mono tabular-nums">{formatCurrency(item.unitPrice, ar)}</TableCell>
                      <TableCell className="text-xs font-semibold text-brand-navy-600 dark:text-brand-navy-400 text-end font-mono tabular-nums">{formatCurrency(item.total, ar)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-brand-navy-600 dark:hover:text-brand-navy-400" onClick={() => openEditDialog(item)} aria-label="Edit">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 dark:hover:text-red-400" onClick={() => { setSelectedItem(item); setShowDeleteDialog(true); }} aria-label="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ===== FOOTER - Category Subtotals + Grand Total ===== */}
          {filteredItems.length > 0 && activeCategoryTab === "all" && (
            <div className="border-t border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/20 p-4">
              {Object.entries(categorySubtotals).map(([cat, subtotal]) => (
                <div key={cat} className="flex justify-between text-xs py-1">
                  <span className="text-slate-500 dark:text-slate-400">{getCategoryLabel(cat, ar)}</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">{formatCurrency(subtotal, ar)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-900 dark:text-white">{tAuto('auto.grandTotal')}</span>
                <span className="text-brand-navy-600 dark:text-brand-navy-400 font-mono tabular-nums">{formatCurrency(filteredTotal, ar)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== ADD ITEM DIALOG ===== */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tAuto('auto.addNewItem')}</DialogTitle>
            <DialogDescription>{tAuto('auto.enterBOQItemDetails')}</DialogDescription>
          </DialogHeader>
          <BOQItemForm
            ar={ar}
            formData={formData}
            setFormData={setFormData}
            projects={projects}
            currentProjectFilter={projectFilter}
            isLoading={createMutation.isPending}
            onSubmit={() => createMutation.mutate(formData)}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ===== EDIT ITEM DIALOG ===== */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tAuto('auto.editItem')}</DialogTitle>
            <DialogDescription>{tAuto('auto.editBOQItemDetails')}</DialogDescription>
          </DialogHeader>
          <BOQItemForm
            ar={ar}
            formData={formData}
            setFormData={setFormData}
            projects={projects}
            currentProjectFilter={projectFilter}
            isLoading={updateMutation.isPending}
            onSubmit={() => {
              if (selectedItem) updateMutation.mutate({ id: selectedItem.id, data: formData });
            }}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">{tAuto('auto.deleteItem1')}</DialogTitle>
            <DialogDescription>
              {ar ? `هل أنت متأكد من حذف "${selectedItem?.description}"؟` : `Are you sure you want to delete "${selectedItem?.description}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="text-xs">
              {tAuto('auto.cancel')}
            </Button>
            <Button
              onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs"
            >
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 me-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 me-1" />}
              {tAuto('auto.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== BOQ Item Form Component =====
function BOQItemForm({
  ar,
  formData,
  setFormData,
  projects: _projects,
  currentProjectFilter: _currentProjectFilter,
  isLoading,
  onSubmit,
  onCancel,
}: {
  ar: boolean;
  formData: { code: string; description: string; unit: string; quantity: number; unitPrice: number; category: string; projectId: string };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  projects: Project[];
  currentProjectFilter: string;
  isLoading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const tAuto = useTranslations();
  const computedTotal = formData.quantity * formData.unitPrice;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">{tAuto('auto.itemCode')}</Label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="C-001"
            className="bg-slate-50 dark:bg-slate-800 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{tAuto('auto.category')} *</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger className="bg-slate-50 dark:bg-slate-800 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOQ_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {ar ? cat.label : cat.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{tAuto('auto.description')} *</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={tAuto('auto.itemDescription')}
          className="bg-slate-50 dark:bg-slate-800 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">{tAuto('auto.unit')} *</Label>
          <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
            <SelectTrigger className="bg-slate-50 dark:bg-slate-800 text-sm">
              <SelectValue placeholder={tAuto('auto.unit')} />
            </SelectTrigger>
            <SelectContent>
              {BOQ_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{tAuto('auto.quantity')} *</Label>
          <Input
            type="number"
            value={formData.quantity || ""}
            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
            className="bg-slate-50 dark:bg-slate-800 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{tAuto('auto.unitPrice')} *</Label>
          <Input
            type="number"
            value={formData.unitPrice || ""}
            onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
            className="bg-slate-50 dark:bg-slate-800 text-sm font-mono"
          />
        </div>
      </div>

      {/* Auto-calculated Total */}
      <div className="flex items-center justify-between p-3 bg-brand-navy-50 dark:bg-brand-navy-900/20 rounded-lg border border-brand-navy-100 dark:border-brand-navy-800/30">
        <span className="text-sm text-slate-600 dark:text-slate-400">{tAuto('auto.total')}</span>
        <span className="text-lg font-bold text-brand-navy-600 dark:text-brand-navy-400 font-mono tabular-nums">
          {formatCurrency(computedTotal, ar)}
        </span>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="text-xs">
          {tAuto('auto.cancel')}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!formData.description || !formData.unit || formData.quantity <= 0 || formData.unitPrice <= 0 || isLoading}
          className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white border-0 text-xs"
        >
          {isLoading ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
          {tAuto('auto.save')}
        </Button>
      </DialogFooter>
    </div>
  );
}
