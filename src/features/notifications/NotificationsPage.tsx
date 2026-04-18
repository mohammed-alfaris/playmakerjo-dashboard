import { useState, useCallback, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Send, Plus, Trash2, Pencil, Copy, Loader2,
  Search, Bell, BellOff, ImageIcon, Users as UsersIcon,
  CheckCircle2, Layers, MoreHorizontal,
} from "lucide-react"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import {
  getUsersWithFcm,
  sendNotification,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type UserWithFcm,
  type NotificationTemplate,
} from "@/api/notifications"

const TYPES = ["general", "update", "promo", "maintenance"] as const
const ROLES = ["super_admin", "venue_owner", "player", "venue_staff"] as const

/** Chip class for a notification type — uses stadium chip tokens */
function typeChip(type: string) {
  switch (type) {
    case "update":      return "chip-indigo"
    case "promo":       return "chip-brand"
    case "maintenance": return "chip-amber"
    default:            return "chip-ghost"
  }
}

/** Matches the accent color of the type chip — used in the phone preview */
function typeAccent(type: string): "brand" | "amber" | "indigo" | "ghost" {
  switch (type) {
    case "update":      return "indigo"
    case "promo":       return "brand"
    case "maintenance": return "amber"
    default:            return "ghost"
  }
}

function roleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function NotificationsPage() {
  const { t } = useT()
  const qc = useQueryClient()

  // ── User list state ───────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  // ── Notification form state ───────────────────────────────────────────
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [type, setType] = useState("general")
  const [image, setImage] = useState("")

  // ── Template dialog state ─────────────────────────────────────────────
  const [templateDialog, setTemplateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null)
  const [tplName, setTplName] = useState("")
  const [tplTitle, setTplTitle] = useState("")
  const [tplBody, setTplBody] = useState("")
  const [tplType, setTplType] = useState("general")

  // ── Delete confirm ────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["notify-users", search, roleFilter, page],
    queryFn: () => getUsersWithFcm({
      search: search || undefined,
      role: roleFilter === "all" ? undefined : roleFilter,
      page,
      limit: 50,
    }),
  })
  const users: UserWithFcm[] = useMemo(() => usersData?.data ?? [], [usersData])
  const totalUsers = usersData?.pagination?.total ?? 0
  const totalPages = Math.ceil(totalUsers / 50)

  const { data: templatesData } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: getTemplates,
  })
  const templates: NotificationTemplate[] = templatesData?.data ?? []

  // ── Computed ──────────────────────────────────────────────────────────
  const allVisibleSelected = useMemo(
    () => users.length > 0 && users.every((u) => selectedIds.has(u.id)),
    [users, selectedIds]
  )

  const fcmActiveCount = useMemo(
    () => users.filter((u) => u.hasFcm).length,
    [users]
  )
  const fcmPct = users.length ? Math.round((fcmActiveCount / users.length) * 100) : 0

  // ── Mutations ─────────────────────────────────────────────────────────
  const sendMut = useMutation({
    mutationFn: sendNotification,
    onSuccess: (data) => {
      toast.success(data.message || t("notification_sent"))
      setTitle("")
      setBody("")
      setType("general")
      setImage("")
      setSelectedIds(new Set())
    },
    onError: () => toast.error(t("notification_send_failed")),
  })

  const createTplMut = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      toast.success(t("template_created"))
      qc.invalidateQueries({ queryKey: ["notification-templates"] })
      setTemplateDialog(false)
    },
    onError: () => toast.error(t("template_create_failed")),
  })

  const updateTplMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name: string; title: string; body: string; type: string }) =>
      updateTemplate(id, payload),
    onSuccess: () => {
      toast.success(t("template_updated"))
      qc.invalidateQueries({ queryKey: ["notification-templates"] })
      setTemplateDialog(false)
    },
    onError: () => toast.error(t("template_update_failed")),
  })

  const deleteTplMut = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast.success(t("template_deleted"))
      qc.invalidateQueries({ queryKey: ["notification-templates"] })
      setDeleteId(null)
    },
    onError: () => toast.error(t("template_delete_failed")),
  })

  // ── Handlers ──────────────────────────────────────────────────────────
  const toggleUser = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        users.forEach((u) => next.delete(u.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        users.forEach((u) => next.add(u.id))
        return next
      })
    }
  }, [allVisibleSelected, users])

  const handleSend = useCallback(() => {
    if (selectedIds.size === 0 || !title.trim() || !body.trim()) return
    sendMut.mutate({
      userIds: Array.from(selectedIds),
      title: title.trim(),
      body: body.trim(),
      type,
      image: image.trim() || undefined,
    })
  }, [selectedIds, title, body, type, image, sendMut])

  const handleUseTemplate = useCallback((tpl: NotificationTemplate) => {
    setTitle(tpl.title)
    setBody(tpl.body)
    setType(tpl.type)
  }, [])

  const openCreateTemplate = useCallback(() => {
    setEditingTemplate(null)
    setTplName("")
    setTplTitle("")
    setTplBody("")
    setTplType("general")
    setTemplateDialog(true)
  }, [])

  const openEditTemplate = useCallback((tpl: NotificationTemplate) => {
    setEditingTemplate(tpl)
    setTplName(tpl.name)
    setTplTitle(tpl.title)
    setTplBody(tpl.body)
    setTplType(tpl.type)
    setTemplateDialog(true)
  }, [])

  const handleSaveTemplate = useCallback(() => {
    if (!tplName.trim() || !tplTitle.trim() || !tplBody.trim()) return
    const payload = { name: tplName.trim(), title: tplTitle.trim(), body: tplBody.trim(), type: tplType }
    if (editingTemplate) {
      updateTplMut.mutate({ id: editingTemplate.id, ...payload })
    } else {
      createTplMut.mutate(payload)
    }
  }, [tplName, tplTitle, tplBody, tplType, editingTemplate, createTplMut, updateTplMut])

  const typeLabel = (tp: string) => {
    switch (tp) {
      case "general":     return t("type_general")
      case "update":      return t("type_update")
      case "promo":       return t("type_promo")
      case "maintenance": return t("type_maintenance")
      default: return tp
    }
  }

  const isSending = sendMut.isPending
  const isSavingTpl = createTplMut.isPending || updateTplMut.isPending
  const canSend = selectedIds.size > 0 && title.trim() !== "" && body.trim() !== ""

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight text-ink">
            {t("notifications")}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {t("manage_notifications")}
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniKpi
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={t("selected_count")}
            value={selectedIds.size}
            tone="brand"
          />
          <MiniKpi
            icon={<UsersIcon className="h-4 w-4" />}
            label={t("users")}
            value={totalUsers}
            tone="indigo"
          />
          <MiniKpi
            icon={<Bell className="h-4 w-4" />}
            label="FCM Active"
            value={`${fcmPct}%`}
            tone="brand"
          />
          <MiniKpi
            icon={<Layers className="h-4 w-4" />}
            label={t("saved_templates")}
            value={templates.length}
            tone="amber"
          />
        </div>

        {/* Composer + Live Preview */}
        <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
          {/* Composer */}
          <section className="rounded-2xl bg-card p-5 shadow-stadium-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="chip-brand flex h-9 w-9 items-center justify-center rounded-lg">
                <Send className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="display text-[15px] font-semibold tracking-tight text-ink">
                  {t("send_notification")}
                </div>
                <div className="text-[11px] text-ink-3">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} ${t("selected_count")}`
                    : t("no_users_selected")}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <StadiumField label={t("notification_type")}>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-9 rounded-lg border-0 bg-surface-2 text-sm font-medium text-ink focus:ring-1 focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StadiumField>

              <StadiumField label={t("notification_title")}>
                <StadiumInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("notification_title")}
                />
              </StadiumField>

              <StadiumField
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <ImageIcon className="h-3 w-3" />
                    {t("notification_image")}
                  </span>
                }
                className="sm:col-span-2"
              >
                <StadiumInput
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder={t("notification_image_hint")}
                />
              </StadiumField>

              <StadiumField label={t("notification_body")} className="sm:col-span-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("notification_body")}
                  rows={3}
                  className="w-full resize-y rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </StadiumField>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-[11px] text-ink-3">
                {canSend
                  ? `${t("ready_to_send") ?? "Ready to send"} → ${selectedIds.size}`
                  : t("select_users_and_fill") ?? "Select recipients and fill title + body"}
              </div>
              <Button
                onClick={handleSend}
                disabled={!canSend || isSending}
                className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isSending
                  ? t("sending")
                  : `${t("send_to_selected")} (${selectedIds.size})`}
              </Button>
            </div>
          </section>

          {/* Phone-style live preview */}
          <section className="rounded-2xl bg-card p-5 shadow-stadium-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                {t("preview") ?? "Preview"}
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", typeChip(type))}>
                {typeLabel(type)}
              </span>
            </div>
            <PhonePreview
              title={title || t("notification_title")}
              body={body || t("notification_body_placeholder") || t("notification_body")}
              accent={typeAccent(type)}
              image={image}
            />
          </section>
        </div>

        {/* Recipients */}
        <section className="rounded-2xl bg-card p-5 shadow-stadium-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="chip-indigo flex h-9 w-9 items-center justify-center rounded-lg">
              <UsersIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="display text-[15px] font-semibold tracking-tight text-ink">
                {t("users")}
              </div>
              <div className="text-[11px] text-ink-3">
                {totalUsers} {t("users").toLowerCase()} · {selectedIds.size} {t("selected_count")}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3 ltr:left-2.5 rtl:right-2.5" />
              <input
                type="text"
                placeholder={t("search_users_notify")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="h-9 w-full rounded-lg bg-surface-2 pe-3 ps-8 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => { setRoleFilter(v); setPage(1) }}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-lg border-0 bg-surface-2 text-sm font-medium text-ink focus:ring-1 focus:ring-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_roles")}</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl bg-surface-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line/60">
                  <th className="w-10 px-3 py-2.5 text-start">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer rounded accent-primary"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    {t("name")}
                  </th>
                  <th className="hidden px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 md:table-cell">
                    {t("email")}
                  </th>
                  <th className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    {t("role")}
                  </th>
                  <th className="px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    FCM
                  </th>
                  <th className="hidden px-3 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3 lg:table-cell">
                    {t("status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-ink-3">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-ink-3">
                      {t("no_users")}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelected = selectedIds.has(u.id)
                    return (
                      <tr
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        className={cn(
                          "cursor-pointer border-b border-line/40 transition-colors last:border-0",
                          isSelected ? "bg-primary/10" : "hover:bg-card/60"
                        )}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 cursor-pointer rounded accent-primary"
                            checked={isSelected}
                            onChange={() => toggleUser(u.id)}
                            aria-label={`Select ${u.name}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7">
                              {u.avatar && <AvatarImage src={u.avatar} alt={u.name} />}
                              <AvatarFallback className="bg-surface-3 text-[10px] text-ink-2">
                                {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                              <p className="truncate text-[11px] text-ink-3 md:hidden">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-sm text-ink-2 md:table-cell">
                          <span className="truncate">{u.email}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-ink-2">
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {u.hasFcm ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand">
                              <Bell className="h-3 w-3" />
                              <span className="hidden sm:inline">
                                {u.fcmPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
                              <BellOff className="h-3 w-3" />
                              <span className="hidden sm:inline">{t("fcm_inactive")}</span>
                            </span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 lg:table-cell">
                          {u.status === "active" ? (
                            <span className="chip-brand rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              {t("status_active")}
                            </span>
                          ) : (
                            <span className="chip-rose rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              {t("status_banned")}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-ink-3">
                {t("page")} {page} {t("of")} {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("prev")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Templates */}
        <section className="rounded-2xl bg-card p-5 shadow-stadium-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="chip-amber flex h-9 w-9 items-center justify-center rounded-lg">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="display text-[15px] font-semibold tracking-tight text-ink">
                {t("saved_templates")}
              </div>
              <div className="text-[11px] text-ink-3">
                {templates.length} {templates.length === 1 ? "template" : "templates"}
              </div>
            </div>
            <Button
              size="sm"
              onClick={openCreateTemplate}
              className="h-8 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("add_template")}
            </Button>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl bg-surface-2 py-10 text-center text-sm text-ink-3">
              {t("no_templates")}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="group relative flex flex-col gap-2 rounded-xl bg-surface-2 p-4 transition-colors hover:bg-surface-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink">{tpl.name}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", typeChip(tpl.type))}>
                      {typeLabel(tpl.type)}
                    </span>
                  </div>
                  <p className="truncate text-[13px] font-medium text-ink-2">{tpl.title}</p>
                  <p className="line-clamp-2 text-[11px] text-ink-3">{tpl.body}</p>
                  <div className="hair mt-1" />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 gap-1 text-[11px] font-medium text-ink-2 hover:text-ink"
                      onClick={() => handleUseTemplate(tpl)}
                    >
                      <Copy className="h-3 w-3" />
                      {t("use_template")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-ink-3 hover:text-ink"
                      onClick={() => openEditTemplate(tpl)}
                      aria-label={t("edit_template")}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-ink-3 hover:text-rose"
                      onClick={() => setDeleteId(tpl.id)}
                      aria-label={t("delete_template")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Template Create/Edit Dialog ────────────────────────────────── */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="display tracking-tight">
              {editingTemplate ? t("edit_template") : t("create_template")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <StadiumField label={t("template_name")}>
              <StadiumInput value={tplName} onChange={(e) => setTplName(e.target.value)} />
            </StadiumField>
            <StadiumField label={t("notification_type")}>
              <Select value={tplType} onValueChange={setTplType}>
                <SelectTrigger className="h-9 rounded-lg border-0 bg-surface-2 text-sm font-medium text-ink focus:ring-1 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StadiumField>
            <StadiumField label={t("notification_title")}>
              <StadiumInput value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} />
            </StadiumField>
            <StadiumField label={t("notification_body")}>
              <textarea
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </StadiumField>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setTemplateDialog(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!tplName.trim() || !tplTitle.trim() || !tplBody.trim() || isSavingTpl}
              className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSavingTpl && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingTemplate ? t("save_changes") : t("create_template")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t("delete_template")}
        description={t("delete_template_confirm")}
        onConfirm={() => deleteId && deleteTplMut.mutate(deleteId)}
        isLoading={deleteTplMut.isPending}
      />
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function MiniKpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  tone: "brand" | "amber" | "rose" | "indigo"
}) {
  const chipCls = {
    brand:  "chip-brand",
    amber:  "chip-amber",
    rose:   "chip-rose",
    indigo: "chip-indigo",
  }[tone]
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-stadium-sm">
      <div className={cn("flex h-9 w-9 flex-none items-center justify-center rounded-lg", chipCls)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {label}
        </div>
        <div className="display num text-[20px] font-semibold leading-tight text-ink">
          {value}
        </div>
      </div>
    </div>
  )
}

function StadiumField({
  label,
  className,
  children,
}: {
  label: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </span>
      {children}
    </label>
  )
}

function StadiumInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-lg bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary",
        props.className
      )}
    />
  )
}

function PhonePreview({
  title,
  body,
  image,
  accent,
}: {
  title: string
  body: string
  image?: string
  accent: "brand" | "amber" | "indigo" | "ghost"
}) {
  const dotCls = {
    brand:  "bg-brand",
    amber:  "bg-amber",
    indigo: "bg-indigo",
    ghost:  "bg-ink-3",
  }[accent]
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      {/* status bar */}
      <div className="mono flex items-center justify-between px-1 pb-2 text-[9px] text-ink-3">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-3" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-3" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-3" />
        </span>
      </div>

      {/* notification card */}
      <div className="rounded-xl bg-card p-3 shadow-stadium-sm">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-semibold text-ink">
                PlayMaker JO
              </span>
              <span className={cn("h-1 w-1 rounded-full", dotCls)} />
              <span className="mono text-[9px] text-ink-3">now</span>
              <MoreHorizontal className="ms-auto h-3 w-3 text-ink-3" />
            </div>
            <div className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-ink">
              {title}
            </div>
            <div className="mt-0.5 line-clamp-3 text-[11px] text-ink-2">
              {body}
            </div>
          </div>
        </div>
        {image && /^https?:\/\//.test(image) && (
          <img
            src={image}
            alt=""
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            className="mt-2.5 h-24 w-full rounded-lg object-cover"
          />
        )}
      </div>
    </div>
  )
}
