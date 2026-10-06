"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Camera, Mic, MicOff, Sparkles, CheckCircle2, AlertTriangle, 
  ArrowRight, Send, MapPin,
  Building, ShieldAlert, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getMutationHeaders } from "@/lib/csrf-client";
import { cn } from "@/lib/utils";

interface FieldPortalProps {
  language: "ar" | "en";
}

interface ProjectBasic {
  id: string;
  name: string;
  number?: string;
  location?: string;
}

interface ExtractedDefect {
  title: string;
  severity: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  location: string;
  recommendation: string;
}

export default function FieldPortalPage({ language }: FieldPortalProps) {
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  // Active view: "hub" | "new_visit" | "new_defect"
  const [activeView, setActiveView] = useState<"hub" | "new_visit" | "new_defect">("hub");

  // GPS Coordinates state
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Extracted defects from AI
  const [aiDefects, setAiDefects] = useState<ExtractedDefect[]>([]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const recognitionRef = useRef<unknown>(null);

  // AI Formatting loading
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Form states
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [visitDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [visitPurpose, setVisitPurpose] = useState("");
  const [visitFindings, setVisitFindings] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  // Defect specific form states
  const [defectTitle, setDefectTitle] = useState("");
  const [defectSeverity, setDefectSeverity] = useState<"LOW" | "NORMAL" | "HIGH" | "CRITICAL">("NORMAL");
  const [defectLocation, setDefectLocation] = useState("");
  const [defectDesc, setDefectDesc] = useState("");

  // Hidden Camera input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch available projects
  const { data: projects = [] } = useQuery<ProjectBasic[]>({
    queryKey: ["projects-simple-field"],
    queryFn: async () => {
      const res = await fetch("/api/projects-simple");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
  });

  // Auto-select first project if available
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // 2. Fetch Recent Site Visits
  const { data: recentVisits = [] } = useQuery<Array<{ id: string; date: string; status: string; municipality?: string; project?: { name?: string } }>>({
    queryKey: ["recent-field-visits"],
    queryFn: async () => {
      const res = await fetch("/api/site-visits?limit=5");
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
  });

  // 3. Speech Recognition Setup (Web Speech API)
  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current && typeof (recognitionRef.current as { stop?: () => void }).stop === "function") {
        (recognitionRef.current as { stop: () => void }).stop();
      }
      setIsRecording(false);
      return;
    }

    const windowSpeech = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition || 
                         (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!windowSpeech) {
      toast.error(isAr ? "المتصفح لا يدعم التسجيل الصوتي المباشر. يمكنك كتابة الملاحظات." : "Browser does not support direct voice recognition.");
      return;
    }

    try {
      const recognition = new windowSpeech() as {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
        onerror: (e: { error: string }) => void;
        onend: () => void;
        start: () => void;
      };
      recognition.lang = isAr ? "ar-AE" : "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript + " ";
        }
        setSpeechTranscript(currentText.trim());
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      toast.info(isAr ? "جارٍ الاستماع... تحدث بوضوح في الموقع" : "Listening... speak clearly on site");
    } catch (err) {
      console.error(err);
      toast.error(isAr ? "تعذر تفعيل المايكروفون" : "Could not activate microphone");
      setIsRecording(false);
    }
  };

  // GPS Location Trigger
  const handleGetGpsLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error(isAr ? "خاصية تحديد الموقع الجغرافي غير مدعومة في جهازك" : "Geolocation is not supported by your device");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
        toast.success(isAr ? `تم تحديد إحداثيات الموقع بدقة: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` : `GPS captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setIsLocating(false);
        toast.error(isAr ? "تعذر تحديد الموقع الجغرافي (تأكد من إذن الموقع)" : "Could not retrieve GPS coordinates");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // 4. AI Voice Report Generator
  const handleProcessWithAi = async () => {
    if (!speechTranscript) {
      toast.warning(isAr ? "يرجى تسجيل صوتي أولاً أو كتابة ملاحظات" : "Record voice or enter notes first");
      return;
    }

    setIsAiProcessing(true);
    const selectedProj = projects.find(p => p.id === selectedProjectId);

    try {
      const res = await fetch("/api/ai/site-assistant", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          audioTranscript: speechTranscript,
          action: "format_inspection",
          projectName: selectedProj?.name,
          language: language,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const json = await res.json();
      if (json.data) {
        const { title, findings, notes, recommendations, defects } = json.data;
        if (title) setVisitPurpose(title);
        if (findings) setVisitFindings(findings);
        if (notes || recommendations) {
          setVisitNotes([notes, recommendations ? `\nالتوصيات: ${recommendations}` : ""].filter(Boolean).join("\n"));
        }
        if (Array.isArray(defects) && defects.length > 0) {
          setAiDefects(defects);
        }

        toast.success(isAr ? "تمت صياغة التقرير الهندسي واستخراج الملاحظات بالذكاء الاصطناعي بنجاح!" : "AI formulated inspection report & extracted defects successfully!");
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? "تعذر المعالجة بالذكاء الاصطناعي، تم الاحتفاظ بنصك" : "AI processing failed, text retained");
      setVisitFindings(speechTranscript);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // 5. Native Camera capture handler
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert to preview base64 or upload
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrls((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });

    toast.success(isAr ? `تم التقاط ${files.length} صورة بنجاح` : `Captured ${files.length} photos`);
  };

  // 6. Submit Site Visit Mutation
  const createVisitMutation = useMutation({
    mutationFn: async () => {
      const gpsInfo = gpsLocation ? `\n[إحداثيات الموقع GPS]: ${gpsLocation.lat.toFixed(6)}, ${gpsLocation.lng.toFixed(6)}` : "";
      const finalNotes = visitNotes + gpsInfo;

      const res = await fetch("/api/site-visits", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          projectId: selectedProjectId,
          date: new Date(visitDate).toISOString(),
          purpose: visitPurpose || (isAr ? "معاينة موقع روتينية" : "Routine inspection"),
          findings: visitFindings,
          notes: finalNotes,
          buildingDesc: gpsLocation ? `GPS: ${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}` : "",
          status: "submitted",
          photos: photoUrls.join("||"),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save visit");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isAr ? "تم حفظ تقرير الزيارة بنجاح وإرساله للمكتب!" : "Visit saved and transmitted to office!");
      queryClient.invalidateQueries({ queryKey: ["recent-field-visits"] });
      // Reset form
      setVisitPurpose("");
      setVisitFindings("");
      setVisitNotes("");
      setPhotoUrls([]);
      setSpeechTranscript("");
      setActiveView("hub");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit");
    },
  });

  // 7. Submit Defect Mutation
  const createDefectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error(isAr ? "اختر المشروع" : "Select project");
      if (!defectTitle) throw new Error(isAr ? "اكتب عنوان الملاحظة" : "Enter defect title");

      const res = await fetch("/api/defects", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          projectId: selectedProjectId,
          title: defectTitle,
          severity: defectSeverity,
          location: defectLocation,
          description: defectDesc,
          photos: photoUrls.join("||"),
          status: "OPEN",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to report defect");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isAr ? "تم تسجيل الملاحظة وتوجيهها للمقاول!" : "Defect logged and assigned to contractor!");
      setDefectTitle("");
      setDefectDesc("");
      setDefectLocation("");
      setPhotoUrls([]);
      setActiveView("hub");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit defect");
    },
  });

  return (
    <div className="max-w-xl mx-auto px-3 py-4 space-y-4">
      {/* Hidden file input with native camera capture */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handlePhotoCapture}
      />

      {/* Header bar for Field Portal */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              {isAr ? "بوابة المهندس الميداني" : "Field Engineer Portal"}
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                {isAr ? "مباشر" : "Live"}
              </Badge>
            </h1>
            <p className="text-xs text-slate-500">
              {isAr ? "أدوات الموقع السريعة والذكاء الاصطناعي الميداني" : "Rapid site tools & AI field assistant"}
            </p>
          </div>
        </div>

        {activeView !== "hub" && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setActiveView("hub")}
            className="text-xs gap-1"
          >
            <ArrowRight className={cn("w-4 h-4", !isAr && "rotate-180")} />
            {isAr ? "رجوع" : "Back"}
          </Button>
        )}
      </div>

      {/* Project selector dropdown (Persistent across views) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <Label className="text-xs text-slate-500 mb-1.5 block">
          {isAr ? "المشروع الميداني الحالي:" : "Current Site Project:"}
        </Label>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-full bg-white dark:bg-slate-950 font-medium">
            <SelectValue placeholder={isAr ? "اختر المشروع..." : "Select project..."} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((proj) => (
              <SelectItem key={proj.id} value={proj.id}>
                {proj.name} {proj.number ? `(${proj.number})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW 1: FIELD HUB (Main Dashboard for Site Engineers)     */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeView === "hub" && (
        <div className="space-y-4">
          {/* 3 Main Action Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Quick Visit Card */}
            <Card 
              onClick={() => setActiveView("new_visit")}
              className="p-4 rounded-3xl border-2 border-brand-navy-200 dark:border-brand-navy-900 bg-gradient-to-br from-brand-navy-500/10 via-white to-white dark:from-brand-navy-950/40 dark:via-slate-900 dark:to-slate-900 cursor-pointer active:scale-95 transition-all shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand-navy-600 text-white flex items-center justify-center mb-3 shadow-md shadow-brand-navy-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                {isAr ? "تسجيل زيارة موقع" : "New Site Visit"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                {isAr ? "صوتي بالذكاء الاصطناعي مع صور الكاميرا" : "Voice AI report & site photos"}
              </p>
            </Card>

            {/* Quick Defect Card */}
            <Card 
              onClick={() => setActiveView("new_defect")}
              className="p-4 rounded-3xl border-2 border-rose-200 dark:border-rose-900 bg-gradient-to-br from-rose-500/10 via-white to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 cursor-pointer active:scale-95 transition-all shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center mb-3 shadow-md shadow-rose-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                {isAr ? "رصد عيب / ملاحظة" : "Report Defect"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">
                {isAr ? "إشعار المقاول الفوري مع صورة الإثبات" : "Instant contractor notice & photo"}
              </p>
            </Card>
          </div>

          {/* Direct Camera Button (One-Touch) */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold gap-2 text-sm shadow-md active:scale-98 transition-all"
          >
            <Camera className="w-5 h-5 text-amber-400 dark:text-amber-600" />
            {isAr ? "التقاط صور ميدانية مباشرة (الكاميرا)" : "Take Direct Field Photos (Camera)"}
          </Button>

          {/* Photo Preview Strip if photos were captured */}
          {photoUrls.length > 0 && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 block">
                {isAr ? `الصور الملتقطة (${photoUrls.length}):` : `Captured Photos (${photoUrls.length}):`}
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Site" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Site Visits Feed */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? "آخر المعاينات المسجلة بالموقع:" : "Recent Site Inspections:"}
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                {recentVisits.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {recentVisits.map((visit) => (
                <div 
                  key={visit.id} 
                  className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {visit.project?.name || (isAr ? "مشروع" : "Project")}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {new Date(visit.date).toLocaleDateString(isAr ? "ar-AE" : "en-US")} • {visit.status}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {visit.status === "approved" || visit.status === "COMPLETED" 
                      ? (isAr ? "معتمد" : "Approved")
                      : visit.status === "submitted"
                      ? (isAr ? "مُرسل للمراجعة" : "Submitted")
                      : (isAr ? "مسودة" : "Draft")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW 2: NEW SITE VISIT (Voice AI Enabled)                  */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeView === "new_visit" && (
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-amber-500" />
              {isAr ? "تقرير الزيارة الذكي (صوتي)" : "AI Voice Inspection Report"}
            </h2>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
              {isAr ? "مدعوم بالذكاء الاصطناعي" : "AI Powered"}
            </Badge>
          </div>

          {/* Voice Dictation Box */}
          <div className="p-3 bg-amber-500/5 dark:bg-amber-950/20 rounded-2xl border border-amber-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                {isRecording ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                ) : null}
                {isAr ? "الملاحظات الصوتية الميدانية:" : "Voice Dictation Notes:"}
              </span>
              <Button
                size="sm"
                variant={isRecording ? "destructive" : "default"}
                onClick={toggleRecording}
                className="h-8 px-3 rounded-xl text-xs gap-1.5 font-semibold"
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {isRecording ? (isAr ? "إيقاف التسجيل" : "Stop") : (isAr ? "ابدأ التحدث" : "Speak Now")}
              </Button>
            </div>

            <Textarea
              value={speechTranscript}
              onChange={(e) => setSpeechTranscript(e.target.value)}
              placeholder={isAr ? "تحدث أو اكتب الملاحظات هنا... (مثال: صب أعمدة الدور الأرضي تم بنجاح مع وجود ملاحظة على كانات عمود C3)" : "Speak or write your field observations here..."}
              className="text-xs bg-white dark:bg-slate-950 resize-none h-20 rounded-xl"
            />

            <Button
              onClick={handleProcessWithAi}
              disabled={isAiProcessing || !speechTranscript}
              className="w-full h-9 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <Sparkles className={cn("w-3.5 h-3.5", isAiProcessing && "animate-spin")} />
              {isAiProcessing 
                ? (isAr ? "جارٍ الصياغة بالذكاء الاصطناعي..." : "Formulating with AI...") 
                : (isAr ? "تحويل الكلام لتقرير رسمي بالذكاء الاصطناعي" : "Formulate Official Report with AI")}
            </Button>
          </div>

          {/* Form Fields Auto-filled by AI */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{isAr ? "موضوع الزيارة:" : "Visit Purpose / Subject:"}</Label>
              <Input
                value={visitPurpose}
                onChange={(e) => setVisitPurpose(e.target.value)}
                placeholder={isAr ? "عنوان الزيارة..." : "Visit title..."}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">{isAr ? "نتائج المعاينة الفنية (Findings):" : "Inspection Findings:"}</Label>
              <Textarea
                value={visitFindings}
                onChange={(e) => setVisitFindings(e.target.value)}
                rows={3}
                placeholder={isAr ? "ما تم رصده في الموقع..." : "Findings on site..."}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">{isAr ? "توصيات وملاحظات الاستشاري:" : "Consultant Recommendations:"}</Label>
              <Textarea
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                rows={2}
                placeholder={isAr ? "تعليمات للمقاول..." : "Instructions to contractor..."}
                className="text-xs mt-1"
              />
            </div>

            {/* GPS Location Capture Section */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className={cn("w-4 h-4", gpsLocation ? "text-emerald-500" : "text-slate-400")} />
                <div>
                  <span className="text-[11px] font-semibold block text-slate-700 dark:text-slate-300">
                    {isAr ? "إثبات موقع المهندس (GPS):" : "Engineer Site Verification (GPS):"}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {gpsLocation 
                      ? `${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)} ✓`
                      : (isAr ? "لم يتم التحديد" : "Not captured")}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGetGpsLocation}
                disabled={isLocating}
                className="h-7 text-[11px] px-2.5 rounded-lg gap-1"
              >
                <MapPin className="w-3 h-3 text-emerald-600" />
                {isLocating 
                  ? (isAr ? "جارٍ التحديد..." : "Locating...") 
                  : (isAr ? "تحديد موقعي" : "Capture GPS")}
              </Button>
            </div>

            {/* AI Extracted Defects Card (if any found) */}
            {aiDefects.length > 0 && (
              <div className="p-3 bg-rose-500/5 dark:bg-rose-950/20 rounded-2xl border border-rose-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {isAr ? `عيوب استخرجها الذكاء الاصطناعي (${aiDefects.length}):` : `AI Extracted Defects (${aiDefects.length}):`}
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                    {isAr ? "تحويل للمقاول" : "Send to Snag"}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {aiDefects.map((def, idx) => (
                    <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{def.title}</div>
                        <div className="text-[10px] text-slate-500">{def.location} • {def.recommendation}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDefectTitle(def.title);
                          setDefectLocation(def.location);
                          setDefectDesc(def.recommendation);
                          setDefectSeverity(def.severity);
                          setActiveView("new_defect");
                        }}
                        className="h-6 text-[10px] text-rose-600 hover:text-rose-700 px-2 font-bold"
                      >
                        {isAr ? "تسجيل كعيب ←" : "Log Defect →"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photos & Camera Action */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">{isAr ? "صور التوثيق من الكاميرا:" : "Site Documentation Photos:"}</Label>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-[11px] gap-1 px-2.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isAr ? "إضافة صورة" : "Add Photo"}
                </Button>
              </div>

              {photoUrls.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photoUrls.map((url, idx) => (
                    <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  {isAr ? "لم يتم إرفاق صور بعد (اضغط إضافة صورة لفتح كاميرا الموبايل)" : "No photos yet (tap Add Photo to open camera)"}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={() => createVisitMutation.mutate()}
            disabled={createVisitMutation.isPending}
            className="w-full h-11 rounded-2xl bg-brand-navy-600 hover:bg-brand-navy-700 text-white font-bold text-xs gap-1.5 shadow-md"
          >
            <Send className="w-4 h-4" />
            {createVisitMutation.isPending 
              ? (isAr ? "جارٍ الحفظ والإرسال..." : "Saving & Transmitting...") 
              : (isAr ? "اعتماد التقرير وإرساله للمكتب" : "Approve & Transmit Report")}
          </Button>
        </Card>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW 3: NEW DEFECT (Fast Snagging)                        */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeView === "new_defect" && (
        <Card className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {isAr ? "تسجيل عيب أو مخالفة فورية" : "Log Site Defect / Snag"}
            </h2>
            <Badge variant="destructive" className="text-[10px]">
              {isAr ? "ميداني سريع" : "Fast Snag"}
            </Badge>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">{isAr ? "عنوان العيب / المشكلة:" : "Defect Title:"}</Label>
              <Input
                value={defectTitle}
                onChange={(e) => setDefectTitle(e.target.value)}
                placeholder={isAr ? "مثال: تعشيش في قاعدة عمود المحور 4" : "e.g., Honeycombing in column base"}
                className="text-xs mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{isAr ? "درجة الخطورة:" : "Severity:"}</Label>
                <Select value={defectSeverity} onValueChange={(val: "LOW" | "NORMAL" | "HIGH" | "CRITICAL") => setDefectSeverity(val)}>
                  <SelectTrigger className="text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{isAr ? "منخفضة (Low)" : "Low"}</SelectItem>
                    <SelectItem value="NORMAL">{isAr ? "متوسطة (Normal)" : "Normal"}</SelectItem>
                    <SelectItem value="HIGH">{isAr ? "عالية (High)" : "High"}</SelectItem>
                    <SelectItem value="CRITICAL">{isAr ? "حرجة جداً (Critical)" : "Critical"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">{isAr ? "مكان العيب:" : "Location:"}</Label>
                <Input
                  value={defectLocation}
                  onChange={(e) => setDefectLocation(e.target.value)}
                  placeholder={isAr ? "مثال: السطح / الدور الأرضي" : "e.g., Ground Floor"}
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">{isAr ? "شرح وتوصية المعالجة:" : "Description & Remedy:"}</Label>
              <Textarea
                value={defectDesc}
                onChange={(e) => setDefectDesc(e.target.value)}
                rows={3}
                placeholder={isAr ? "تفاصيل المشكلة وما هو مطلوب من المقاول لتصحيحها..." : "Details and remediation steps..."}
                className="text-xs mt-1"
              />
            </div>

            {/* Photo Capture */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 border-dashed rounded-xl gap-2 text-xs"
              >
                <Camera className="w-4 h-4 text-rose-500" />
                {isAr ? "التقاط صورة العيب بالكاميرا" : "Snap Photo of Defect"}
              </Button>
              {photoUrls.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pt-2">
                  {photoUrls.map((url, idx) => (
                    <div key={idx} className="w-14 h-14 rounded-lg overflow-hidden border border-rose-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Defect" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={() => createDefectMutation.mutate()}
            disabled={createDefectMutation.isPending}
            className="w-full h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-md"
          >
            <ShieldAlert className="w-4 h-4" />
            {createDefectMutation.isPending 
              ? (isAr ? "جارٍ الحفظ والتوجيه..." : "Saving...") 
              : (isAr ? "تسجيل الملاحظة وتوجيهها للمقاول" : "Submit Defect Notice")}
          </Button>
        </Card>
      )}
    </div>
  );
}
