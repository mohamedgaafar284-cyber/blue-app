"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusIcon } from "@/components/ui/status-icon";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MapPin,
  Calendar,
  Building2,
  Eye,
  Trash2,
  Filter,
  DoorOpen,
  Home,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMutationHeaders } from "@/lib/csrf-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

// ===== Types =====
interface SiteVisitItem {
  id: string;
  projectId: string;
  date: string;
  plotNumber: string;
  municipality: string;
  gateDescription: string;
  neighborDesc: string;
  buildingDesc: string;
  status: string;
  notes: string;
  project: {
    id: string;
    name: string;
    nameEn: string;
    number: string;
    latitude?: number | null;
    longitude?: number | null;
    client: { id: string; name: string; company: string }
  } | null;
}

interface ProjectOption {
  id: string;
  name: string;
  nameEn: string;
  number: string;
}

// ===== Helpers =====
const municipalities = [
  { value: "RAS_AL_KHAIMAH", ar: "رأس الخيمة", en: "Ras Al Khaimah" },
  { value: "DUBAI", ar: "دبي", en: "Dubai" },
  { value: "ABU_DHABI", ar: "أبوظبي", en: "Abu Dhabi" },
  { value: "SHARJAH", ar: "الشارقة", en: "Sharjah" },
  { value: "AJMAN", ar: "عجمان", en: "Ajman" },
  { value: "UMM_AL_QUWAIN", ar: "أم القيوين", en: "Umm Al Quwain" },
  { value: "FUJAIRAH", ar: "الفجيرة", en: "Fujairah" },
];

function getMunicipalityLabel(val: string, ar: boolean) {
  return ar
    ? municipalities.find((m) => m.value === val)?.ar || val
    : municipalities.find((m) => m.value === val)?.en || val;
}

function getStatusConfig(status: string) {
  const norm = (status || "").toUpperCase();
  const configs: Record<string, { label: string; labelEn: string; color: string }> = {
    DRAFT: { label: "مسودة", labelEn: "Draft", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    SUBMITTED: { label: "مرسل", labelEn: "Submitted", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
    APPROVED: { label: "معتمد", labelEn: "Approved", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
    COMPLETED: { label: "مكتمل", labelEn: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  };
  return configs[norm] || configs.DRAFT;
}

// ===== Weather conditions =====
const weatherOptions = [
  { value: "sunny", ar: "☀️ مشمس", en: "Sunny" },
  { value: "cloudy", ar: "☁️ غائم", en: "Cloudy" },
  { value: "rainy", ar: "🌧️ ماطر", en: "Rainy" },
  { value: "hot", ar: "🔥 حار", en: "Hot" },
  { value: "windy", ar: "💨 عاصف", en: "Windy" },
];

function getWeatherBadge(value: string, ar: boolean) {
  const cfg = weatherOptions.find((w) => w.value === value);
  if (!cfg) return null;
  const bgMap: Record<string, string> = {
    sunny: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    cloudy: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    rainy: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
    hot: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    windy: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full", bgMap[value] || bgMap.sunny)}>
      {ar ? cfg.ar.split(" ")[0] : cfg.en.split(" ")[0]} {ar ? cfg.ar.split(" ")[1] : ""}
    </span>
  );
}

function getFrequencyDot(freq: string) {
  const dots: Record<string, { color: string; label: string; labelEn: string }> = {
    weekly: { color: "bg-emerald-500", label: "أسبوعي", labelEn: "Weekly" },
    biweekly: { color: "bg-amber-500", label: "نصف شهري", labelEn: "Bi-weekly" },
    monthly: { color: "bg-slate-400", label: "شهري", labelEn: "Monthly" },
  };
  return dots[freq] || dots.monthly;
}

// ===== Main Component =====
interface SiteVisitsProps {
  language: "ar" | "en";
  projectId?: string;
}

export default function SiteVisits({ language, projectId }: SiteVisitsProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<SiteVisitItem | null>(null);
  const [filterProject, setFilterProject] = useState<string>(projectId || "all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch site visits
  const { data: siteVisits = [], isLoading } = useQuery<SiteVisitItem[]>({
    queryKey: ["site-visits", filterProject, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterProject !== "all") params.set("projectId", filterProject);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/site-visits?${params}`);
      if (!res.ok) throw new Error("Failed to fetch site visits");
      const json = await res.json(); return json.data || json;
    },
  });

  // Fetch projects
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
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create site visit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-visits"] });
      setShowAddDialog(false);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/site-visits/${id}`, { method: "DELETE", headers: getMutationHeaders() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-visits"] });
    },
  });



  const [formData, setFormData] = useState({
    projectId: projectId || "",
    date: new Date().toISOString().split("T")[0],
    plotNumber: "",
    municipality: "",
    gateDescription: "",
    neighborDesc: "",
    buildingDesc: "",
    status: "DRAFT",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      projectId: projectId || (filterProject !== "all" ? filterProject : ""),
      date: new Date().toISOString().split("T")[0],
      plotNumber: "",
      municipality: "",
      gateDescription: "",
      neighborDesc: "",
      buildingDesc: "",
      status: "DRAFT",
      notes: "",
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center">
            <MapPin className="h-4.5 w-4.5 text-brand-navy-600 dark:text-brand-navy-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {tAuto('auto.siteVisits')}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {siteVisits.length} {tAuto('auto.visits')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!projectId && (
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Filter className="h-3 w-3 me-1 text-slate-400" />
              <SelectValue placeholder={tAuto('auto.project')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.allProjects')}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {ar ? p.name : p.nameEn || p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder={tAuto('auto.status1')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.all')}</SelectItem>
              <SelectItem value="DRAFT">{tAuto('auto.draft')}</SelectItem>
              <SelectItem value="SUBMITTED">{tAuto('auto.submitted')}</SelectItem>
              <SelectItem value="APPROVED">{tAuto('auto.approved')}</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="h-8 bg-brand-navy-600 hover:bg-brand-navy-700 text-white rounded-lg shadow-sm shadow-brand-navy-600/20"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-3.5 w-3.5 me-1" />
            {tAuto('auto.newVisit')}
          </Button>
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : siteVisits.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <MapPin className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            {tAuto('auto.noSiteVisits')}
          </h3>
          <p className="text-sm text-slate-500">
            {tAuto('auto.startByAddingANewSiteVisit')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {siteVisits.map((visit) => {
            const statusCfg = getStatusConfig(visit.status);
            const visitDate = new Date(visit.date);
            return (
              <Card
                key={visit.id}
                className="p-4 border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => { setSelectedVisit(visit); setShowDetailDialog(true); }}
              >
                {/* Top: Date + Frequency + Actions */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{visitDate.toLocaleDateString(ar ? "ar-AE" : "en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                    </div>
                    {/* Visit frequency indicator */}
                    <span className="inline-flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                      <span className={cn("w-1.5 h-1.5 rounded-full", getFrequencyDot("weekly").color)} title={tAuto('auto.weekly')} />
                      <span className={cn("w-1.5 h-1.5 rounded-full", getFrequencyDot("biweekly").color)} title={tAuto('auto.biWeekly')} />
                      <span className={cn("w-1.5 h-1.5 rounded-full", getFrequencyDot("monthly").color)} title={tAuto('auto.monthly')} />
                    </span>
                    {/* Weather badge - deterministic from date */}
                    {getWeatherBadge(weatherOptions[visit.id.charCodeAt(visit.id.length - 1) % weatherOptions.length].value, ar)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className={`text-[10px] h-5 px-1.5 flex items-center gap-1 ${statusCfg.color}`}>
                      <StatusIcon status={visit.status} className="h-3 w-3" />
                      {ar ? statusCfg.label : statusCfg.labelEn}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-600" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={ar ? "start" : "end"} className="w-36">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedVisit(visit); setShowDetailDialog(true); }}>
                          <Eye className="h-3.5 w-3.5 me-2" />
                          {tAuto('auto.view')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-400 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(tAuto('auto.deleteThisVisit'))) {
                              deleteMutation.mutate(visit.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 me-2" />
                          {tAuto('auto.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Plot Number */}
                {visit.plotNumber && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="h-3.5 w-3.5 text-brand-navy-500" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{visit.plotNumber}</span>
                  </div>
                )}

                {/* Municipality Badge */}
                {visit.municipality && (
                  <Badge variant="outline" className="text-[10px] h-5 mb-2 border-slate-300 dark:border-slate-600">
                    {getMunicipalityLabel(visit.municipality, ar)}
                  </Badge>
                )}

                {/* Project & Client */}
                {visit.project && (
                  <div className="space-y-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{ar ? visit.project.name : visit.project.nameEn || visit.project.name}</span>
                    </div>
                    {visit.project.client && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-500">
                        <Users className="h-3 w-3" />
                        <span className="truncate">{visit.project?.client?.company || visit.project?.client?.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Location Map */}
                {(() => {
                  const lat = visit.project?.latitude ?? 25.7895;
                  const lon = visit.project?.longitude ?? 55.9432;
                  const offset = 0.005;
                  const minLon = lon - offset;
                  const minLat = lat - offset;
                  const maxLon = lon + offset;
                  const maxLat = lat + offset;
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span>{tAuto('auto.locationMap')}</span>
                      </div>
                      <div className="mt-1.5 h-32 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-700/30">
                        <iframe
                          title={tAuto('auto.locationMap')}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${lat}%2C${lon}`}
                        />
                      </div>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-brand-navy-500 hover:text-brand-navy-600 mt-1 inline-block"
                      >
                        {tAuto('auto.openLargerMap')}
                      </a>
                    </div>
                  );
                })()}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tAuto('auto.newSiteVisit')}</DialogTitle>
            <DialogDescription>
              {tAuto('auto.addANewSiteVisitRecord')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.project2')}</Label>
                <Select value={formData.projectId} onValueChange={(v) => setFormData({ ...formData, projectId: v })}>
                  <SelectTrigger><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.date1')}</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.plotNumber')}</Label>
                <Input
                  value={formData.plotNumber}
                  onChange={(e) => setFormData({ ...formData, plotNumber: e.target.value })}
                  placeholder={tAuto('auto.plotNumber1')}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.municipality')}</Label>
                <Select value={formData.municipality} onValueChange={(v) => setFormData({ ...formData, municipality: v })}>
                  <SelectTrigger><SelectValue placeholder={tAuto('auto.selectMunicipality')} /></SelectTrigger>
                  <SelectContent>
                    {municipalities.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{ar ? m.ar : m.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <DoorOpen className="h-3.5 w-3.5" />
                {tAuto('auto.gateDescription')}
              </Label>
              <Textarea
                value={formData.gateDescription}
                onChange={(e) => setFormData({ ...formData, gateDescription: e.target.value })}
                placeholder={tAuto('auto.doorOpenAndSiteDescription')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" />
                {tAuto('auto.neighborDescription')}
              </Label>
              <Textarea
                value={formData.neighborDesc}
                onChange={(e) => setFormData({ ...formData, neighborDesc: e.target.value })}
                placeholder={tAuto('auto.descriptionOfNeighboringBuildings')}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {tAuto('auto.buildingDescription')}
              </Label>
              <Textarea
                value={formData.buildingDesc}
                onChange={(e) => setFormData({ ...formData, buildingDesc: e.target.value })}
                placeholder={tAuto('auto.buildingAndConstructionDescription')}
                rows={2}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.status1')}</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">{tAuto('auto.draft')}</SelectItem>
                  <SelectItem value="SUBMITTED">{tAuto('auto.submitted')}</SelectItem>
                  <SelectItem value="APPROVED">{tAuto('auto.approved')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={tAuto('auto.additionalNotes')}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              {tAuto('auto.cancel')}
            </Button>
            <Button
              className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white"
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.projectId || !formData.date || createMutation.isPending}
            >
              {createMutation.isPending ? (tAuto('auto.creating')) : (tAuto('auto.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedVisit && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-brand-navy-500" />
                  {selectedVisit.plotNumber || (tAuto('auto.siteVisit'))}
                </DialogTitle>
                <DialogDescription>
                  {new Date(selectedVisit.date).toLocaleDateString(ar ? "ar-AE" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={getStatusConfig(selectedVisit.status).color}>
                    {ar ? getStatusConfig(selectedVisit.status).label : getStatusConfig(selectedVisit.status).labelEn}
                  </Badge>
                  {selectedVisit.municipality && (
                    <Badge variant="outline">{getMunicipalityLabel(selectedVisit.municipality, ar)}</Badge>
                  )}
                </div>

                {selectedVisit.project && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-1">
                    <div className="text-xs text-slate-500">{tAuto('auto.project')}</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {ar ? selectedVisit.project.name : selectedVisit.project.nameEn || selectedVisit.project.name}
                    </div>
                    {selectedVisit.project.client && (
                      <div className="text-xs text-slate-500">
                        {selectedVisit.project?.client?.company || selectedVisit.project?.client?.name}
                      </div>
                    )}
                  </div>
                )}

                {selectedVisit.gateDescription && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <DoorOpen className="h-4 w-4" />
                      {tAuto('auto.gateDescription')}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      {selectedVisit.gateDescription}
                    </p>
                  </div>
                )}

                {selectedVisit.neighborDesc && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Home className="h-4 w-4" />
                      {tAuto('auto.neighborDescription')}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      {selectedVisit.neighborDesc}
                    </p>
                  </div>
                )}

                {selectedVisit.buildingDesc && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <Building2 className="h-4 w-4" />
                      {tAuto('auto.buildingDescription')}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      {selectedVisit.buildingDesc}
                    </p>
                  </div>
                )}

                {selectedVisit.notes && (
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {tAuto('auto.notes')}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      {selectedVisit.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
