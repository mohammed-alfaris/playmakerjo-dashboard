import { useState, useEffect, useCallback, useRef } from "react"
import { UserFormDialog } from "./UserFormDialog"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { Search, ShieldOff, ShieldCheck, Camera, Users, X, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getUsers, updateUserStatus, updateUserRole, updateUserAvatar, type User } from "@/api/users"
import { usePagination } from "@/hooks/usePagination"
import { useRole } from "@/hooks/useRole"
import { USER_ROLES, USER_STATUSES } from "@/lib/constants"
import { formatDate } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"

const ROLE_AVATAR_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700",
  venue_owner: "bg-blue-100 text-blue-700",
  venue_staff: "bg-amber-100 text-amber-700",
  player:      "bg-zinc-100 text-zinc-700",
}

function userInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { userId } = useRole()
  const { page, limit, setPage, resetPage } = usePagination()
  const { t, lang } = useT()

  const [searchInput, setSearchInput]   = useState("")
  const [search, setSearch]             = useState("")
  const [role, setRole]                 = useState("all")
  const [status, setStatus]             = useState("all")
  const [banTarget, setBanTarget]       = useState<User | null>(null)
  const [createOpen, setCreateOpen]     = useState(false)
  const avatarInputRef                  = useRef<HTMLInputElement>(null)
  const avatarTargetRef                 = useRef<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); resetPage() }, 400)
    return () => clearTimeout(t)
  }, [searchInput, resetPage])

  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (v: string) => { setter(v); resetPage() },
    [resetPage]
  )

  const { data, isLoading } = useQuery({
    queryKey: ["users", { page, limit, search, role: role === "all" ? "" : role, status: status === "all" ? "" : status }],
    queryFn: () => getUsers({
      page, limit, search,
      role: role === "all" ? undefined : role,
      status: status === "all" ? undefined : status,
    }),
  })

  const users: User[] = data?.data ?? []
  const pagination    = data?.pagination ?? { page, limit, total: 0 }

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: "active" | "banned" }) =>
      updateUserStatus(id, newStatus),
    onSuccess: () => {
      toast.success(t("user_status_updated"))
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setBanTarget(null)
    },
    onError: () => toast.error(t("user_status_failed")),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, newRole }: { id: string; newRole: string }) =>
      updateUserRole(id, newRole),
    onSuccess: () => {
      toast.success(t("role_updated"))
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: () => toast.error(t("role_update_failed")),
  })

  const avatarMutation = useMutation({
    mutationFn: ({ id, avatar }: { id: string; avatar: string }) =>
      updateUserAvatar(id, avatar),
    onSuccess: () => {
      toast.success(t("avatar_updated"))
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: () => toast.error(t("avatar_update_failed")),
  })

  function handleAvatarClick(id: string) {
    avatarTargetRef.current = id
    avatarInputRef.current?.click()
  }

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !avatarTargetRef.current) return
    e.target.value = ""
    try {
      const { uploadFile } = await import("@/api/uploads")
      const url = await uploadFile(file, "avatar")
      avatarMutation.mutate({ id: avatarTargetRef.current!, avatar: url })
    } catch (err) {
      console.error("Avatar upload failed:", err)
      toast.error(t("avatar_update_failed"))
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      id: "user",
      header: t("name"),
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex items-center gap-3">
            <div
              className="relative cursor-pointer group shrink-0"
              onClick={() => handleAvatarClick(u.id)}
              title="Click to change avatar"
            >
              <Avatar className="h-8 w-8">
                {u.avatar && <AvatarImage src={u.avatar} alt={u.name} />}
                <AvatarFallback
                  className={cn("text-xs font-medium", ROLE_AVATAR_COLORS[u.role] ?? "bg-zinc-100 text-zinc-700")}
                >
                  {userInitials(u.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-3 w-3 text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">{u.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "phone",
      header: t("phone"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.phone}</span>
      ),
    },
    {
      accessorKey: "role",
      header: t("role"),
      cell: ({ row }) => {
        const isSelf = row.original.id === userId
        return (
          <Select
            value={row.original.role}
            onValueChange={(newRole) => roleMutation.mutate({ id: row.original.id, newRole })}
            disabled={isSelf || roleMutation.isPending}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {lang === "ar" ? r.labelAr : r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: t("joined"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => {
        const u        = row.original
        const isSelf   = u.id === userId
        const isBanned = u.status === "banned"

        if (isSelf) return <span className="text-xs text-muted-foreground">—</span>

        return isBanned ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => statusMutation.mutate({ id: u.id, newStatus: "active" })}
            disabled={statusMutation.isPending}
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            {t("activate")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setBanTarget(u)}
          >
            <ShieldOff className="mr-1 h-3 w-3" />
            {t("ban")}
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users")}
        subtitle={t("manage_users")}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("create_user")}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search_users")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={role} onValueChange={handleFilterChange(setRole)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("all_roles")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_roles")}</SelectItem>
            {USER_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {lang === "ar" ? r.labelAr : r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={handleFilterChange(setStatus)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t("all_statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_statuses")}</SelectItem>
            {USER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {lang === "ar" ? s.labelAr : s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || role !== "all" || status !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setSearchInput(""); setSearch(""); setRole("all"); setStatus("all"); resetPage() }}
          >
            <X className="h-3 w-3 me-1" />
            {t("clear_filters")}
          </Button>
        )}
      </div>

      {/* Hidden avatar file input */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFileChange}
      />

      <DataTable
        columns={columns}
        data={users}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("no_users")}
        emptyIcon={Users}
      />

      <ConfirmDialog
        open={!!banTarget}
        onOpenChange={(v) => { if (!v) setBanTarget(null) }}
        title={t("ban_user")}
        description={`${t("ban_user_confirm").replace("{name}", banTarget?.name ?? "")}`}
        confirmLabel={t("ban_user")}
        isLoading={statusMutation.isPending}
        onConfirm={() => banTarget && statusMutation.mutate({ id: banTarget.id, newStatus: "banned" })}
      />

      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
