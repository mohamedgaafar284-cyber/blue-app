"use client";


import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoiceSchema, type InvoiceFormData } from "@/lib/validations";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastAction } from "@/components/ui/toast";
import { BulkActionBar } from "@/components/common/bulk-action-bar";
import { generateInvoicePDF } from "@/lib/pdf-utils";
import { getMutationHeaders } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import { VAT_RATE } from "@/lib/constants";

import type { InvoiceItem, Invoice, ProjectOption, ClientOption } from "./invoices/types";
import { getEmptyLineItem } from "./invoices/helpers";
import { InvoiceHeader } from "./invoices/invoice-header";
import { StatusDonut } from "./invoices/status-donut";
import { SummaryCards } from "./invoices/summary-cards";
import { InvoiceTable } from "./invoices/invoice-table";
import { InvoicePrintDialog } from "./invoices/invoice-print-dialog";
import { InvoiceFormDialog } from "./invoices/invoice-form-dialog";
import { InvoiceRecordPaymentDialog } from "./invoices/invoice-record-payment-dialog";

// ===== Main Component =====
interface InvoicesPageProps {
  language: "ar" | "en";
  projectId?: string;
}

export default function InvoicesPage({ language, projectId }: InvoicesPageProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const toast = useToastFeedback({ ar });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());
  const deleteTimeouts = useRef<NodeJS.Timeout[]>([]);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const currentTimeouts = deleteTimeouts.current;
    return () => {
      currentTimeouts.forEach(clearTimeout);
    };
  }, []);

  const emptyForm = {
    number: "",
    clientId: "",
    projectId: projectId || "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: "DRAFT" as string,
    currency: "AED",
    items: [getEmptyLineItem()],
  };

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema) as Resolver<InvoiceFormData>,
    defaultValues: {
      number: "",
      clientId: "",
      projectId: projectId || "",
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      status: "DRAFT",
    },
  });
  const { register, handleSubmit: rhfHandleSubmit, formState: { errors }, reset, setValue, watch } = form;
  const [formData, setFormData] = useState(emptyForm);

  // Fetch invoices
  const { data: invoicesData, isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices${projectId ? `?projectId=${projectId}` : ''}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      return json.data || json.invoices || json;
    },
  });
  const invoices = Array.isArray(invoicesData) ? invoicesData : [];

  // Fetch clients
  const { data: clientsData, isError: clientsError } = useQuery<ClientOption[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      // Surface failures instead of silently showing an empty client list —
      // a silent [] made users think they had no clients during an API outage.
      if (!res.ok) throw new Error("Failed to fetch clients");
      const json = await res.json();
      return json.data || json;
    },
  });
  const clients = Array.isArray(clientsData) ? clientsData : [];

  // Fetch projects
  const { data: projects = [], isError: projectsError } = useQuery<ProjectOption[]>({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const res = await fetch("/api/projects-simple");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  // Surface lookup failures — the invoice form needs these lists to be usable.
  // NOTE: toast helpers are recreated each render, so deps track only the error flags
  // (fires once per false -> true transition, no toast spam on re-renders).
  useEffect(() => {
    if (clientsError) {
      toast.showError(ar ? "فشل تحميل قائمة العملاء — حاول تحديث الصفحة" : "Failed to load clients — please refresh");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsError, ar]);
  useEffect(() => {
    if (projectsError) {
      toast.showError(ar ? "فشل تحميل قائمة المشاريع — حاول تحديث الصفحة" : "Failed to load projects — please refresh");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsError, ar]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const tax = subtotal * VAT_RATE;
      const total = subtotal + tax;
      const items = data.items.map((i) => ({ ...i, total: i.quantity * i.unitPrice }));
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({ ...data, items, subtotal, tax, total }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(errData.error, 'Failed to create invoice'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", projectId] });
      setShowDialog(false);
      setFormData(emptyForm);
      localStorage.removeItem("draft_invoice_form");
      toast.created(tAuto('auto.invoice'));
    },
    onError: (error: Error) => {
      toast.showError(ar ? `فشل في إنشاء الفاتورة: ${error.message}` : `Failed to create invoice: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyForm }) => {
      const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const tax = subtotal * VAT_RATE;
      const total = subtotal + tax;
      const items = data.items.map((i) => ({ ...i, total: i.quantity * i.unitPrice }));
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ ...data, items, subtotal, tax, total }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(errData.error, 'Failed to update invoice'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", projectId] });
      setEditInvoice(null);
      setFormData(emptyForm);
      toast.updated(tAuto('auto.invoice'));
    },
    onError: (error: Error) => {
      toast.showError(ar ? `فشل في تحديث الفاتورة: ${error.message}` : `Failed to update invoice: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "DELETE",
        headers: getMutationHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(data.error, 'Failed to delete invoice'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", projectId] });
      toast.deleted(tAuto('auto.invoice'));
    },
    onError: (error: Error) => {
      toast.showError(ar ? `فشل في حذف الفاتورة: ${error.message}` : `Failed to delete invoice: ${error.message}`);
    },
  });

  // Filter
  const filtered = invoices.filter((inv) => {
    if (optimisticDeletedIds.has(inv.id)) return false;
    const matchSearch =
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.client?.name.toLowerCase().includes(search.toLowerCase()) ||
      (ar ? inv.project?.name : inv.project?.nameEn || inv.project?.name).toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedFiltered = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // PDF Export handler
  const handleExportPDF = async (inv: Invoice) => {
    try {
      await generateInvoicePDF({
        number: inv.number,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        subtotal: inv.subtotal,
        tax: inv.tax,
        taxRate: inv.taxRate,
        total: inv.total,
        clientName: inv.client.name,
        clientCompany: inv.client.company,
        projectName: ar ? inv.project.name : inv.project.nameEn || inv.project.name,
        items: inv.items,
        status: inv.status,
      }, language);
      toast.showSuccess(tAuto('auto.invoicePDFExported'));
    } catch (_e) {
      toast.showError(tAuto('auto.failedToExportPDF'));
    }
  };


  // Summary calculations
  const totalInvoices = filtered.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = filtered.reduce((s, i) => s + Number(i.paidAmount), 0);
  const totalOutstanding = filtered.reduce((s, i) => s + Number(i.remaining), 0);
  const overdueCount = filtered.filter((i) => i.status === "OVERDUE").length;
  const paidCount = filtered.filter((i) => i.status === "PAID").length;
  const pendingCount = filtered.filter((i) => i.status === "SENT" || i.status === "PARTIALLY_PAID").length;
  const totalCount = filtered.length || 1;

  // Donut chart calculations (CSS conic-gradient)
  const paidPct = (paidCount / totalCount) * 360;
  const pendingPct = (pendingCount / totalCount) * 360;
  const overduePct = (overdueCount / totalCount) * 360;

  // Form helpers
  const openEdit = (inv: Invoice) => {
    setEditInvoice(inv);
    reset({
      number: inv.number,
      clientId: inv.clientId,
      projectId: inv.projectId,
      issueDate: inv.issueDate.split("T")[0],
      dueDate: inv.dueDate.split("T")[0],
      status: inv.status as InvoiceFormData["status"],
    });
    setFormData({
      number: inv.number,
      clientId: inv.clientId,
      projectId: inv.projectId,
      issueDate: inv.issueDate.split("T")[0],
      dueDate: inv.dueDate.split("T")[0],
      status: inv.status,
      currency: inv.currency || "AED",
      items: inv.items.length > 0 ? inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })) : [getEmptyLineItem()],
    });
  };

  useEffect(() => {
    if (showDialog && !editInvoice) {
      const timeout = setTimeout(() => {
        setFormData(prev => {
          localStorage.setItem("draft_invoice_form", JSON.stringify(prev));
          return prev;
        });
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [formData, showDialog, editInvoice]);

  const updateLineItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    newItems[idx].total = newItems[idx].quantity * newItems[idx].unitPrice;
    setFormData({ ...formData, items: newItems });
  };

  const addLineItem = () => setFormData({ ...formData, items: [...formData.items, getEmptyLineItem()] });
  const removeLineItem = (idx: number) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });
  };

  const calcSubtotal = formData.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const calcTax = calcSubtotal * VAT_RATE;
  const calcTotal = calcSubtotal + calcTax;

  const handleSave = (data: InvoiceFormData) => {
    const payload = { ...data, items: formData.items, currency: formData.currency || 'AED' };
    if (editInvoice) {
      updateMutation.mutate({ id: editInvoice.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDeleteWithUndo = (idsToDelete: string[]) => {
    setOptimisticDeletedIds(prev => new Set([...prev, ...idsToDelete]));
    setSelectedIds(new Set());
    let isUndone = false;
    
    toast.toast({
      title: tAuto('auto.deletedTemporarily'),
      description: ar ? `تم إخفاء ${idsToDelete.length > 1 ? idsToDelete.length + ' فواتير' : 'الفاتورة'}` : `Hidden ${idsToDelete.length} item(s)`,
      action: (
        <ToastAction altText="Undo" onClick={() => {
           isUndone = true;
           setOptimisticDeletedIds(prev => {
             const next = new Set(prev);
             idsToDelete.forEach(id => next.delete(id));
             return next;
           });
        }}>
          {tAuto('auto.undo')}
        </ToastAction>
      ),
      duration: 5000,
    });
    
    const timeoutId = setTimeout(() => {
       if (!isUndone) {
          idsToDelete.forEach(id => deleteMutation.mutate(id));
       }
    }, 5000);
    deleteTimeouts.current.push(timeoutId);
  };

  const handleDelete = (id: string) => {
    handleDeleteWithUndo([id]);
  };

  const handleBulkDelete = () => {
    handleDeleteWithUndo(Array.from(selectedIds));
  };

  const handleRequestApproval = (inv: Invoice) => {
    fetch("/api/approvals", {
      method: "POST",
      headers: getMutationHeaders(),
      body: JSON.stringify({
        entityType: "invoice",
        entityId: inv.id,
        title: `${tAuto('auto.invoiceApproval')} - ${inv.number}`,
        description: inv.client.name,
        requestedBy: "المستخدم الحالي",
        assignedTo: "المدير",
        amount: inv.total,
      }),
    })
    .then((res) => {
      if (!res.ok) throw new Error('Failed');
      return res.json();
    })
    .then(() => {
      toast.showSuccess(tAuto('auto.approvalRequestSent'));
    })
    .catch(() => {
      toast.showError(tAuto('auto.failedToSendApprovalRequest'));
    });
  };


  const handleFormClose = () => {
    setShowDialog(false);
    setEditInvoice(null);
    reset();
    setFormData(emptyForm);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="py-0 gap-0"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <InvoiceHeader
          ar={ar}
          search={search}
          onSearchChange={(v) => { setSearch(v); setCurrentPage(1); }}
          filterStatus={filterStatus}
          onFilterStatusChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}
          onNewInvoice={() => {
            reset();
            const draft = localStorage.getItem("draft_invoice_form");
            if (draft) {
              try {
                const parsed = JSON.parse(draft);
                setFormData(parsed);
                Object.keys(parsed).forEach(k => {
                  setValue(k as keyof InvoiceFormData, parsed[k as keyof InvoiceFormData]);
                });
                toast.showSuccess(tAuto('auto.draftRestoredSuccessfully'));
              } catch (_e) {
                setFormData(emptyForm);
              }
            } else {
              setFormData(emptyForm);
            }
            setShowDialog(true);
          }}
          invoiceCount={invoices.length}
        />

        <StatusDonut
          ar={ar}
          filteredCount={filtered.length}
          paidCount={paidCount}
          pendingCount={pendingCount}
          overdueCount={overdueCount}
          paidPct={paidPct}
          pendingPct={pendingPct}
          overduePct={overduePct}
        />

        <BulkActionBar
          ar={ar}
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onDeleteSelected={handleBulkDelete}
        />

        <SummaryCards
          ar={ar}
          totalInvoices={totalInvoices}
          totalPaid={totalPaid}
          totalOutstanding={totalOutstanding}
          overdueCount={overdueCount}
        />

        <InvoiceTable
          ar={ar}
          paginatedFiltered={paginatedFiltered}
          filtered={filtered}
          totalInvoices={totalInvoices}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
          onPrint={(inv) => setPrintInvoice(inv)}
          onExportPDF={handleExportPDF}
          onEdit={openEdit}
          onDelete={handleDelete}
          onRequestApproval={handleRequestApproval}
          onRecordPayment={(inv) => setPaymentInvoice(inv)}
          onCreateFirst={() => {
            setFormData(emptyForm);
            reset({
              ...emptyForm,
              status: "DRAFT",
            });
            setShowDialog(true);
          }}
          PAGE_SIZE={PAGE_SIZE}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
        />

        <InvoiceRecordPaymentDialog
          ar={ar}
          open={!!paymentInvoice}
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
        />

        <InvoicePrintDialog
          ar={ar}
          printInvoice={printInvoice}
          onClose={() => setPrintInvoice(null)}
        />

        <InvoiceFormDialog
          ar={ar}
          open={showDialog || !!editInvoice}
          editInvoice={editInvoice}
          onClose={handleFormClose}
          formData={formData}
          setFormData={setFormData}
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          clients={clients}
          projects={projects}
          onSubmit={rhfHandleSubmit(handleSave as (data: unknown) => void) as (e: React.FormEvent) => void}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          calcSubtotal={calcSubtotal}
          calcTax={calcTax}
          calcTotal={calcTotal}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
