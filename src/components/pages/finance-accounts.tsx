/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-lang";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FolderTree, 
  Plus, 
  Search, 
  DollarSign, 
  Layers, 
  Building, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { AccountType } from "@prisma/client";

export default function FinanceAccountsPage() {
  const { t, isAr } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [type, setType] = useState<AccountType>("ASSET");
  const [parentAccountId, setParentAccountId] = useState<string>("NONE");
  const [description, setDescription] = useState("");

  // 1. Fetch Chart of Accounts
  const { data: accounts = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ["finance", "accounts"],
    queryFn: async () => {
      const res = await fetch("/api/finance/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const json = await res.json();
      return json.data;
    },
  });

  // 2. Create Account Mutation
  const createMutation = useMutation({
    mutationFn: async (newAccount: any) => {
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create account");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "accounts"] });
      toast.success(t("تم إنشاء الحساب بنجاح", "Account created successfully"));
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || t("حدث خطأ ما", "Something went wrong"));
    },
  });

  const resetForm = () => {
    setCode("");
    setNameAr("");
    setNameEn("");
    setType("ASSET");
    setParentAccountId("NONE");
    setDescription("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !nameAr || !nameEn || !type) {
      toast.error(t("الرجاء ملء جميع الحقول الإلزامية", "Please fill in all required fields"));
      return;
    }
    createMutation.mutate({
      code,
      nameAr,
      nameEn,
      type,
      parentAccountId: parentAccountId === "NONE" ? undefined : parentAccountId,
      description: description || undefined,
    });
  };

  // Filter accounts by search term and selected tab type
  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.code.includes(search) ||
      acc.nameAr.includes(search) ||
      acc.nameEn.toLowerCase().includes(search.toLowerCase());
    const matchesType = selectedType === "ALL" || acc.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Parent accounts list candidates (accounts of the same type)
  const parentCandidates = accounts.filter((acc) => acc.type === type && !acc.parentAccountId);

  // Helper icons for account types
  const getTypeBadge = (accType: AccountType) => {
    switch (accType) {
      case "ASSET":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">{t("أصول", "Asset")}</Badge>;
      case "LIABILITY":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">{t("التزامات", "Liability")}</Badge>;
      case "EQUITY":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100">{t("حقوق ملكية", "Equity")}</Badge>;
      case "REVENUE":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">{t("إيرادات", "Revenue")}</Badge>;
      case "EXPENSE":
        return <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">{t("مصروفات", "Expense")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-navy-600 dark:text-navy-400" />
            {t("شجرة الحسابات", "Chart of Accounts")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("إدارة الحسابات المالية والدليل المحاسبي للمؤسسة", "Manage financial accounts and corporate ledger structure")}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-navy-600 hover:bg-navy-700 text-white flex items-center gap-1.5 ms-auto sm:ms-0">
                <Plus className="h-4 w-4" />
                {t("إضافة حساب", "Add Account")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("إنشاء حساب مالي جديد", "Create New Financial Account")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="code" className="required">{t("كود الحساب (رقمي)", "Account Code (Numeric)")}</Label>
                    <Input
                      id="code"
                      placeholder="e.g. 1010"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nameAr" className="required">{t("الاسم بالعربية", "Arabic Name")}</Label>
                    <Input
                      id="nameAr"
                      placeholder="مثال: الخزينة الرئيسية"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="nameEn" className="required">{t("الاسم بالإنجليزية", "English Name")}</Label>
                    <Input
                      id="nameEn"
                      placeholder="e.g. Main Cash"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="type" className="required">{t("نوع الحساب", "Account Type")}</Label>
                    <Select value={type} onValueChange={(val) => { setType(val as AccountType); setParentAccountId("NONE"); }}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900">
                        <SelectItem value="ASSET">{t("أصول", "Asset")}</SelectItem>
                        <SelectItem value="LIABILITY">{t("التزامات", "Liability")}</SelectItem>
                        <SelectItem value="EQUITY">{t("حقوق ملكية", "Equity")}</SelectItem>
                        <SelectItem value="REVENUE">{t("إيرادات", "Revenue")}</SelectItem>
                        <SelectItem value="EXPENSE">{t("مصروفات", "Expense")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="parent">{t("الحساب الأب", "Parent Account")}</Label>
                    <Select value={parentAccountId} onValueChange={setParentAccountId}>
                      <SelectTrigger id="parent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900">
                        <SelectItem value="NONE">{t("بلا أب (حساب رئيسي)", "None (Root Account)")}</SelectItem>
                        {parentCandidates.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {isAr ? acc.nameAr : acc.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">{t("الوصف والتفاصيل", "Description & Details")}</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    {t("إلغاء", "Cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} className="bg-navy-600 hover:bg-navy-700 text-white">
                    {createMutation.isPending ? t("جاري الحفظ...", "Saving...") : t("حفظ الحساب", "Save Account")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Quick Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((tType) => {
          const count = accounts.filter((a) => a.type === tType).length;
          const label = ({
            ASSET: [t("الأصول", "Assets"), "border-blue-200 bg-blue-50/30 text-blue-700", DollarSign],
            LIABILITY: [t("الالتزامات", "Liabilities"), "border-amber-200 bg-amber-50/30 text-amber-700", Layers],
            EQUITY: [t("حقوق الملكية", "Equity"), "border-purple-200 bg-purple-50/30 text-purple-700", Building],
            REVENUE: [t("الإيرادات", "Revenues"), "border-emerald-200 bg-emerald-50/30 text-emerald-700", TrendingUp],
            EXPENSE: [t("المصروفات", "Expenses"), "border-rose-200 bg-rose-50/30 text-rose-700", TrendingDown],
          } as Record<string, [string, string, any]>)[tType];

          const IconComponent = label[2] as any;

          return (
            <Card
              key={tType}
              className={`border cursor-pointer transition-all hover:shadow-md ${selectedType === tType ? "ring-2 ring-navy-600" : ""}`}
              onClick={() => setSelectedType(selectedType === tType ? "ALL" : tType)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label[0]}</p>
                  <p className="text-lg font-bold mt-1 text-slate-800 dark:text-slate-200">{count}</p>
                </div>
                <div className={`p-2 rounded-lg border ${label[1]}`}>
                  <IconComponent className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter and Table Card */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("بحث كود أو اسم الحساب...", "Search by code or name...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <Button
                variant={selectedType === "ALL" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("ALL")}
                className={selectedType === "ALL" ? "bg-navy-600 hover:bg-navy-700 text-white" : ""}
              >
                {t("الكل", "All")}
              </Button>
              {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((accType) => (
                <Button
                  key={accType}
                  variant={selectedType === accType ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(accType)}
                  className={selectedType === accType ? "bg-navy-600 hover:bg-navy-700 text-white" : ""}
                >
                  {accType === "ASSET" && t("الأصول", "Assets")}
                  {accType === "LIABILITY" && t("الالتزامات", "Liabilities")}
                  {accType === "EQUITY" && t("حقوق الملكية", "Equity")}
                  {accType === "REVENUE" && t("الإيرادات", "Revenues")}
                  {accType === "EXPENSE" && t("المصروفات", "Expenses")}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 space-y-2">
              <Info className="h-8 w-8 mx-auto text-slate-400" />
              <p className="font-medium">{t("لا توجد حسابات مطابقة", "No accounts matching search criteria")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow>
                    <TableHead className="w-24">{t("الكود", "Code")}</TableHead>
                    <TableHead>{t("اسم الحساب", "Account Name")}</TableHead>
                    <TableHead>{t("النوع", "Type")}</TableHead>
                    <TableHead>{t("الحساب الأب", "Parent Account")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("الوصف", "Description")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((acc) => {
                    const parent = accounts.find((a) => a.id === acc.parentAccountId);
                    return (
                      <TableRow key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-mono font-bold text-navy-600 dark:text-navy-400">{acc.code}</TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                          {isAr ? acc.nameAr : acc.nameEn}
                        </TableCell>
                        <TableCell>{getTypeBadge(acc.type)}</TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-400 text-xs">
                          {parent ? `${parent.code} - ${isAr ? parent.nameAr : parent.nameEn}` : t("رئيسي", "Root")}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-slate-500 dark:text-slate-400 text-xs max-w-xs truncate">
                          {acc.description || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
