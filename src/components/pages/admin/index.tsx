"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, Activity, Zap, DatabaseBackup, RefreshCw } from "lucide-react";
import { getMutationHeaders } from "@/lib/csrf-client";
import { type Props, type UserRecord, type ActivityRecord, type NewUserData } from "./types";
import { AdminStats } from "./admin-stats";
import { UsersTable } from "./users-table";
import { AuditLog } from "./audit-log";
import {
  BackupRestoreTab,
  AutomationTab,
  SystemHealthSidebar,
  MiniActivityTimeline,
} from "./system-settings";

export default function AdminPanel({ language: lang }: Props) {
  const tAuto = useTranslations();
  const isAr = lang === "ar";
  const queryClient = useQueryClient();

  // State
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<NewUserData>({
    name: "",
    email: "",
    role: "VIEWER",
    department: "",
    position: "",
    phone: "",
    password: "",
  });
  const [userSearch, setUserSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery<UserRecord[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
  });
  const users = Array.isArray(usersData) ? usersData : [];

  // Fetch activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityRecord[]>({
    queryKey: ["activity-log", activityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activityFilter !== "all") params.set("actionType", activityFilter);
      const res = await fetch(`/api/activity-log?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
  });

  // Toggle user active mutation (used internally)
  const _toggleUserMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const activeUsers = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <AdminStats isAr={isAr} totalUsers={users.length} activeUsers={activeUsers} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="users" dir={isAr ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between mb-3">
              <TabsList className="grid grid-cols-4 w-fit gap-1 p-1 bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="users" className="gap-1.5 px-4">
                  <Users className="h-4 w-4" />
                  {tAuto('auto.users')}
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-1.5 px-4">
                  <Activity className="h-4 w-4" />
                  {tAuto('auto.activity')}
                </TabsTrigger>
                <TabsTrigger value="automation" className="gap-1.5 px-4">
                  <Zap className="h-4 w-4" />
                  {tAuto('auto.autom')}
                </TabsTrigger>
                <TabsTrigger value="backup" className="gap-1.5 px-4">
                  <DatabaseBackup className="h-4 w-4" />
                  {tAuto('auto.backup')}
                </TabsTrigger>
              </TabsList>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg">
                  <DatabaseBackup className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tAuto('auto.backup')}</span>
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs rounded-lg">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tAuto('auto.clearCache')}</span>
                </Button>
              </div>
            </div>

            {/* Users Tab */}
            <UsersTable
              isAr={isAr}
              users={users}
              usersLoading={usersLoading}
              userSearch={userSearch}
              setUserSearch={setUserSearch}
              addUserOpen={addUserOpen}
              setAddUserOpen={setAddUserOpen}
              newUser={newUser}
              setNewUser={setNewUser}
            />

            {/* Activity Log Tab */}
            <AuditLog
              isAr={isAr}
              activities={activities}
              activitiesLoading={activitiesLoading}
              activityFilter={activityFilter}
              setActivityFilter={setActivityFilter}
            />

            {/* Automation Tab */}
            <AutomationTab isAr={isAr} />

            {/* Backup & Restore Tab */}
            <BackupRestoreTab
              isAr={isAr}
              restoreDialogOpen={restoreDialogOpen}
              setRestoreDialogOpen={setRestoreDialogOpen}
              restoreTarget={restoreTarget}
              setRestoreTarget={setRestoreTarget}
            />
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:flex flex-col gap-4">
          <SystemHealthSidebar isAr={isAr} />
          <MiniActivityTimeline isAr={isAr} activities={activities} />
        </div>
      </div>
    </div>
  );
}
