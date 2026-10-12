"use client";


import { useState } from "react";
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Search, Edit, Trash2, MoreHorizontal, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMutationHeaders } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import { useToast } from "@/hooks/use-toast";
import { type UserRecord, type NewUserData, roleLabels, getAvatarColor, formatTime } from "./types";
import { UserForm } from "./user-form";
import { TempPasswordDialog } from "./temp-password-dialog";

interface UsersTableProps {
  isAr: boolean;
  users: UserRecord[];
  usersLoading: boolean;
  userSearch: string;
  setUserSearch: (search: string) => void;
  addUserOpen: boolean;
  setAddUserOpen: (open: boolean) => void;
  newUser: NewUserData;
  setNewUser: (user: NewUserData) => void;
}

export function UsersTable({
  isAr,
  users,
  usersLoading,
  userSearch,
  setUserSearch,
  addUserOpen,
  setAddUserOpen,
  newUser,
  setNewUser,
}: UsersTableProps) {
  const tAuto = useTranslations();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordUser, setTempPasswordUser] = useState({ name: "", email: "" });

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(userSearch.toLowerCase())
  );

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/users/${id}`, { method: "DELETE", headers: getMutationHeaders() }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: tAuto('auto.error'), description: extractErrorMessage(data.error, tAuto('auto.anErrorOccurred')), variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: tAuto('auto.success'), description: tAuto('auto.userDeleted') });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ role }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) {
        toast({ title: tAuto('auto.error'), description: extractErrorMessage(data.error, tAuto('auto.anErrorOccurred')), variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  // Admin-side password reset — generates a temp password shown ONCE.
  // Solves the "employee forgot password + no SMTP" lockout scenario.
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string; email: string }) =>
      fetch(`/api/users/${id}`, {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({ action: "reset-password" }),
      }).then((r) => r.json()),
    onSuccess: (data, variables) => {
      if (data.error) {
        toast({ title: tAuto('auto.error'), description: extractErrorMessage(data.error, tAuto('auto.anErrorOccurred')), variant: "destructive" });
        return;
      }
      if (data.temporaryPassword) {
        setTempPassword(data.temporaryPassword);
        setTempPasswordUser({ name: variables.name, email: variables.email });
      }
    },
  });

  const handleCreateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <TabsContent value="users" className="mt-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-navy-600" />
              {tAuto('auto.userManagement')}
              <Badge variant="secondary" className="text-xs">
                {users.length} {tAuto('auto.users1')}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={tAuto('auto.searchUsers')}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="ps-9 w-56 h-9 rounded-lg text-sm"
                />
              </div>
              <UserForm
                isAr={isAr}
                addUserOpen={addUserOpen}
                setAddUserOpen={setAddUserOpen}
                newUser={newUser}
                setNewUser={setNewUser}
                onSuccess={handleCreateSuccess}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                    <TableHead className="text-xs font-semibold">{tAuto('auto.user')}</TableHead>
                    <TableHead className="text-xs font-semibold hidden md:table-cell">{tAuto('auto.role')}</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">{tAuto('auto.department')}</TableHead>
                    <TableHead className="text-xs font-semibold hidden lg:table-cell">{tAuto('auto.lastLogin')}</TableHead>
                    <TableHead className="text-xs font-semibold">{tAuto('auto.status1')}</TableHead>
                    <TableHead className="text-xs font-semibold text-end">{tAuto('auto.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, idx) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors",
                        idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/20"
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className={cn("text-xs font-semibold", getAvatarColor(user.name))}>
                                {user.name.charAt(0)?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div
                              className={cn(
                                "absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900",
                                user.isActive ? "bg-emerald-500" : "bg-slate-400"
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate" dir="ltr">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Select
                          value={user.role}
                          onValueChange={(v) => updateRoleMutation.mutate({ id: user.id, role: v })}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {isAr ? label.ar : label.en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-slate-600 dark:text-slate-400">
                        {user.department || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {user.lastLogin ? formatTime(user.lastLogin, isAr) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900",
                            user.isActive ? "bg-emerald-500" : "bg-slate-400"
                          )} />
                          <Badge
                            className={cn(
                              "text-[10px] h-5 px-1.5 font-medium border-0",
                              user.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            )}
                          >
                            {user.isActive
                              ? tAuto('auto.active')
                              : tAuto('auto.disabled')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isAr ? "start" : "end"}>
                            <DropdownMenuItem className="gap-2">
                              <Edit className="h-3.5 w-3.5" />
                              {tAuto('auto.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() =>
                                resetPasswordMutation.mutate({ id: user.id, name: user.name, email: user.email })
                              }
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              {isAr ? "إعادة تعيين كلمة المرور" : "Reset Password"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-red-600 dark:text-red-400"
                              onClick={() => deleteUserMutation.mutate(user.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {tAuto('auto.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* One-time temporary password display (after admin reset) */}
      <TempPasswordDialog
        isAr={isAr}
        open={!!tempPassword}
        onClose={() => setTempPassword(null)}
        password={tempPassword || ""}
        userName={tempPasswordUser.name}
        userEmail={tempPasswordUser.email}
      />
    </TabsContent>
  );
}
