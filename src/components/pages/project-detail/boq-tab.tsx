"use client";

import React from "react";
import { SubTabsNav } from "./helpers";
import { boqSubTabs } from "./constants";
import BOQPage from "@/components/pages/boq";
import DocumentsPage from "@/components/pages/documents";
import RatiosTab from "./ratios-tab";

// ===== BOQ TAB =====
interface BOQTabProps {
  language: "ar" | "en";
  projectId: string | undefined;
  activeSubTab: string;
  onSubTabChange: (id: string) => void;
}

export default function BOQTab({ language, projectId, activeSubTab, onSubTabChange }: BOQTabProps) {
  return (
    <>
      <SubTabsNav 
        tabs={boqSubTabs} 
        activeSubTab={activeSubTab} 
        onSubTabChange={onSubTabChange}
        language={language}
      />
      <div className="border rounded-xl p-4 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        {activeSubTab === "boq" && <BOQPage language={language} projectId={projectId} />}
        {activeSubTab === "specs" && <DocumentsPage language={language} projectId={projectId} />}
        {activeSubTab === "ratios" && <RatiosTab projectId={projectId} language={language} />}
      </div>
    </>
  );
}
