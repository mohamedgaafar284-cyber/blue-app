"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, BookOpen, Eye, Clock, Tag, ChevronRight, ArrowLeft, Trash2, Pencil, LayoutGrid, LayoutList, FolderOpen, FileText, RefreshCw } from 'lucide-react'

import { cn } from "@/lib/utils";
import { getMutationHeaders } from "@/lib/csrf-client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

// ===== Types =====
interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  views: number;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatar: string } | null;
}

// ===== Helpers =====
function getCategoryConfig(cat: string) {
  const configs: Record<string, { ar: string; en: string; color: string; icon: string; stripColor: string }> = {
    guide: { ar: "دليل", en: "Guide", color: "bg-brand-navy-100 text-brand-navy-700 dark:bg-brand-navy-900/50 dark:text-brand-navy-300", icon: "📘", stripColor: "bg-brand-navy-500" },
    faq: { ar: "أسئلة شائعة", en: "FAQ", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", icon: "❓", stripColor: "bg-blue-500" },
    policy: { ar: "سياسة", en: "Policy", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", icon: "📋", stripColor: "bg-amber-500" },
    template: { ar: "قالب", en: "Template", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", icon: "📄", stripColor: "bg-purple-500" },
  };
  return configs[cat] || configs.GUIDE;
}

const avatarColors = [
  "bg-brand-navy-100 dark:bg-brand-navy-900/30 text-brand-navy-700 dark:text-brand-navy-300",
  "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
  "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string) {
  return name.split(" ").map(n => n.charAt(0)).join("").toUpperCase().slice(0, 2);
}

function estimateReadingTime(content: string) {
  const words = content.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return minutes;
}

function relativeTime(dateStr: string, ar: boolean): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return ar ? "الآن" : "Just now";
  if (diffMin < 60) return ar ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  if (diffHrs < 24) return ar ? `منذ ${diffHrs} ساعة` : `${diffHrs}h ago`;
  if (diffDays < 30) return ar ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  if (diffDays < 365) return ar ? `منذ ${Math.floor(diffDays / 30)} شهر` : `${Math.floor(diffDays / 30)}mo ago`;
  return ar ? `منذ ${Math.floor(diffDays / 365)} سنة` : `${Math.floor(diffDays / 365)}y ago`;
}

// ===== Main Component =====
interface KnowledgePageProps {
  language: "ar" | "en";
  projectId?: string;
}

export default function KnowledgePage({ language, projectId }: KnowledgePageProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  const emptyForm = { title: "", content: "", category: "guide", tags: "" };
  const [formData, setFormData] = useState(emptyForm);

  // Fetch articles
  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ["knowledge", projectId, selectedCategory, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/knowledge?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json(); return json.data || json;
    },
  });

  // Fetch article detail (increments views)
  const { data: articleDetail, isLoading: _detailLoading } = useQuery<Article>({
    queryKey: ["knowledge-detail", selectedArticle?.id],
    queryFn: async () => {
      const res = await fetch(`/api/knowledge/${selectedArticle!.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json(); return json.data || json;
    },
    enabled: !!selectedArticle,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({ ...data, projectId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      setShowDialog(false);
      setFormData(emptyForm);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE", headers: getMutationHeaders() });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-all"] });
      setSelectedArticle(null);
      setDeleteTarget(null);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyForm }) => {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-all"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-detail"] });
      setShowDialog(false);
      setEditArticle(null);
      setFormData(emptyForm);
    },
  });

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  const categories = [
    { value: "all", ar: "الكل", en: "All" },
    { value: "guide", ar: "أدلة", en: "Guides" },
    { value: "faq", ar: "أسئلة شائعة", en: "FAQs" },
    { value: "policy", ar: "سياسات", en: "Policies" },
    { value: "template", ar: "قوالب", en: "Templates" },
  ];

  // Stats per category (from articles)
  const categoryCounts: Record<string, number> = {};
  const allArticlesQuery = useQuery<Article[]>({
    queryKey: ["knowledge-all", projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/knowledge?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json(); return json.data || json;
    },
  });
  allArticlesQuery.data?.forEach((a) => {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  });

  const handleSave = () => {
    if (editArticle) {
      updateMutation.mutate({ id: editArticle.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEdit = (article: Article) => {
    setEditArticle(article);
    setFormData({
      title: article.title,
      content: article.content,
      category: article.category,
      tags: article.tags,
    });
    setShowDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh]">
        <div className="w-64 shrink-0 border-e border-slate-200 dark:border-slate-700/50 p-4">
          <Skeleton className="h-8 w-full mb-4" />
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full mb-2" />)}
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-8 w-full mb-4" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full mb-3" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-10rem)]">
      {/* Left Panel - Categories & Search */}
      <div className="w-64 shrink-0 border-e border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 rounded-s-xl overflow-hidden">
        <div className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tAuto('auto.searchArticles')}
              className="ps-9 h-8 text-sm"
            />
          </div>

          <Separator />

          {/* Categories */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">{tAuto('auto.categories')}</p>
            {categories.map((cat) => {
              const count = cat.value === "all" ? articles.length : (categoryCounts[cat.value] || 0);
              const isActive = selectedCategory === cat.value;
              const cfg = cat.value !== "all" ? getCategoryConfig(cat.value) : null;
              return (
                <button
                  key={cat.value}
                  onClick={() => { setSelectedCategory(cat.value); setSelectedArticle(null); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-start ${
                    isActive
                      ? "bg-brand-navy-50 dark:bg-brand-navy-900/20 text-brand-navy-700 dark:text-brand-navy-300 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {cfg && <span className="text-sm">{cfg.icon}</span>}
                  <span className="flex-1">{ar ? cat.ar : cat.en}</span>
                  <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Article Button */}
        <div className="p-4 pt-0">
          <Button
            size="sm"
            className="w-full h-8 bg-brand-navy-600 hover:bg-brand-navy-700 text-white"
            onClick={() => { setFormData(emptyForm); setEditArticle(null); setShowDialog(true); }}
          >
            <Plus className="h-3.5 w-3.5 me-1" />
            {tAuto('auto.newArticle')}
          </Button>
        </div>
      </div>

      {/* Right Panel - Articles List / Detail */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/50">
        {/* Stat cards bar */}
        <div className="p-4 pb-0">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center">
                <FileText className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{allArticlesQuery.data?.length || 0}</p>
                <p className="text-[10px] text-slate-500">{tAuto('auto.totalArticles')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{Object.keys(categoryCounts).length}</p>
                <p className="text-[10px] text-slate-500">{tAuto('auto.categories')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{allArticlesQuery.data?.filter((a) => {
                  const diffDays = Math.floor((Date.now() - new Date(a.updatedAt).getTime()) / 86400000);
                  return diffDays <= 7;
                }).length || 0}</p>
                <p className="text-[10px] text-slate-500">{tAuto('auto.recentUpdates')}</p>
              </div>
            </div>
          </div>
        </div>
        {selectedArticle && articleDetail ? (
          /* Article Detail View */
          <div className="h-full overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4">
              <button
                onClick={() => setSelectedArticle(null)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {tAuto('auto.back')}
              </button>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{articleDetail.title}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {articleDetail.author && <span>{articleDetail.author.name}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(articleDetail.createdAt).toLocaleDateString(ar ? "ar-AE" : "en-US")}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{articleDetail.views}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className={`text-xs ${getCategoryConfig(articleDetail.category).color}`}>
                    {ar ? getCategoryConfig(articleDetail.category).ar : getCategoryConfig(articleDetail.category).en}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => openEdit(articleDetail)}>
                    <Pencil className="h-3.5 w-3.5 me-1 text-brand-navy-600" />
                    {tAuto('auto.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDeleteTarget(articleDetail)}>
                    <Trash2 className="h-3.5 w-3.5 me-1 text-red-500" />
                    {tAuto('auto.delete')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 max-w-3xl">
              {/* Content */}
              <div className="prose prose-slate dark:prose-invert max-w-none">
                {articleDetail.content.split("\n").map((paragraph, idx) => {
                  if (!paragraph.trim()) return <br key={idx} />;
                  if (paragraph.startsWith("# ")) {
                    return <h2 key={idx} className="text-lg font-bold text-slate-900 dark:text-white mt-6 mb-2">{paragraph.slice(2)}</h2>;
                  }
                  if (paragraph.startsWith("## ")) {
                    return <h3 key={idx} className="text-base font-semibold text-slate-900 dark:text-white mt-4 mb-2">{paragraph.slice(3)}</h3>;
                  }
                  return <p key={idx} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">{paragraph}</p>;
                })}
              </div>

              {/* Tags */}
              {articleDetail.tags && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {tAuto('auto.tags')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {articleDetail.tags.split(",").map((tag, idx) => (
                        tag.trim() && (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag.trim()}
                          </Badge>
                        )
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Articles List View */
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {tAuto('auto.articles')}
                  <Badge variant="secondary" className="ms-2 text-xs">{articles.length}</Badge>
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn("p-1.5 rounded-lg transition-colors", viewMode === "grid" ? "bg-brand-navy-50 dark:bg-brand-navy-900/20 text-brand-navy-600" : "text-slate-400 hover:text-slate-600")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("p-1.5 rounded-lg transition-colors", viewMode === "list" ? "bg-brand-navy-50 dark:bg-brand-navy-900/20 text-brand-navy-600" : "text-slate-400 hover:text-slate-600")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {viewMode === "grid" ? (
              <div className="space-y-2">
                {articles.map((article) => {
                  const catCfg = getCategoryConfig(article.category);
                  const authorName = article.author?.name || (tAuto('auto.unknown'));
                  return (
                    <Card
                      key={article.id}
                      className="group hover:shadow-sm transition-all cursor-pointer border-slate-200 dark:border-slate-700/50 hover:border-brand-navy-200 dark:hover:border-brand-navy-800/50 overflow-hidden"
                      onClick={() => setSelectedArticle(article)}
                    >
                      <CardContent className="p-0">
                        <div className={`h-1.5 ${catCfg.stripColor}`} />
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className={`text-[10px] h-5 ${catCfg.color}`}>
                                  {catCfg.icon} {ar ? catCfg.ar : catCfg.en}
                                </Badge>
                                <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0 group-hover:text-brand-navy-500 transition-colors ms-auto" />
                              </div>
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate mb-1">{article.title}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                                {article.content.slice(0, 150)}...
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                {article.tags && article.tags.split(",").slice(0, 3).map((tag, idx) => (
                                  tag.trim() && (
                                    <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      {tag.trim()}
                                    </span>
                                  )
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${getAvatarColor(authorName)}`}>
                                {getInitials(authorName)}
                              </div>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">{authorName}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{estimateReadingTime(article.content)} {ar ? "د" : "min"}</span>
                              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views}</span>
                              <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />{relativeTime(article.updatedAt, ar)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {articles.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{tAuto('auto.noArticlesFound')}</p>
                    <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">{tAuto('auto.tryChangingCategoryOrSearch')}</p>
                  </div>
                )}
              </div>
              ) : (
              <div className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                      <th className="text-xs font-semibold py-2.5 px-3 text-start">{tAuto('auto.title')}</th>
                      <th className="text-xs font-semibold py-2.5 px-3 text-start">{tAuto('auto.category')}</th>
                      <th className="text-xs font-semibold py-2.5 px-3 text-start hidden md:table-cell">{tAuto('auto.author')}</th>
                      <th className="text-xs font-semibold py-2.5 px-3 text-center">{tAuto('auto.reading')}</th>
                      <th className="text-xs font-semibold py-2.5 px-3 text-center">{tAuto('auto.views')}</th>
                      <th className="text-xs font-semibold py-2.5 px-3 text-start">{tAuto('auto.updated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((article, _idx) => {
                      const catCfg = getCategoryConfig(article.category);
                      const authorName = article.author?.name || (tAuto('auto.unknown'));
                      return (
                        <tr
                          key={article.id}
                          className={cn("even:bg-slate-50/50 dark:even:bg-slate-800/20 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors")}
                          onClick={() => setSelectedArticle(article)}
                        >
                          <td className="py-2.5 px-3">
                            <span className="text-xs font-medium text-slate-900 dark:text-white truncate block max-w-[200px]">{article.title}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="secondary" className={`text-[10px] h-5 ${catCfg.color}`}>
                              {catCfg.icon} {ar ? catCfg.ar : catCfg.en}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold ${getAvatarColor(authorName)}`}>
                                {getInitials(authorName)}
                              </div>
                              <span className="text-[11px] text-slate-500">{authorName}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[10px] text-slate-400">{estimateReadingTime(article.content)} {ar ? "د" : "min"}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 py-0.5">
                              <Eye className="h-2.5 w-2.5" />{article.views}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] text-slate-400">{relativeTime(article.updatedAt, ar)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {articles.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{tAuto('auto.noArticlesFound')}</p>
                  </div>
                )}
              </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Add/Edit Article Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditArticle(null); setFormData(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editArticle ? (tAuto('auto.editArticle')) : (tAuto('auto.newArticle'))}</DialogTitle>
            <DialogDescription>{editArticle ? (tAuto('auto.updateArticleDetails')) : (tAuto('auto.addNewArticleToKnowledgeBase'))}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.title')} *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder={tAuto('auto.articleTitle')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.category')} *</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.value !== "all").map((cat) => {
                    return <SelectItem key={cat.value} value={cat.value}>{ar ? cat.ar : cat.en}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.content')}</Label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder={tAuto('auto.writeArticleContentHere')}
                className="w-full min-h-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-brand-navy-500/20 focus:border-brand-navy-500"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.tagsCommaSeparated')}</Label>
              <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder={tAuto('auto.designArchitecturalGuide')} className="h-8 text-sm" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditArticle(null); setFormData(emptyForm); }}>{tAuto('auto.cancel')}</Button>
            <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={handleSave} disabled={!formData.title || createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? (tAuto('auto.saving')) : (editArticle ? (tAuto('auto.update')) : (tAuto('auto.publish')))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tAuto('auto.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? `هل أنت متأكد من حذف المقال "${deleteTarget?.title || ""}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deleteTarget?.title || ""}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tAuto('auto.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (tAuto('auto.deleting')) : (tAuto('auto.delete'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
