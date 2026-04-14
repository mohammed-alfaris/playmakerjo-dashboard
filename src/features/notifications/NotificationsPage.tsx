import { useState, useCallback, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Send, Plus, Trash2, Pencil, Copy, Loader2,
  Search, Smartphone, Bell, BellOff, ImageIcon,
} from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

function typeColor(type: string) {
  switch (type) {
    case "update": return "bg-blue-500/10 text-blue-500"
    case "promo": return "bg-green-500/10 text-green-500"
    case "maintenance": return "bg-orange-500/10 text-orange-500"
    default: return "bg-muted text-muted-foreground"
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
  const users: UserWithFcm[] = usersData?.data ?? []
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
      case "general": return t("type_general")
      case "update": return t("type_update")
      case "promo": return t("type_promo")
      case "maintenance": return t("type_maintenance")
      default: return tp
    }
  }

  const isSending = sendMut.isPending
  const isSavingTpl = createTplMut.isPending || updateTplMut.isPending

  return (
    <>
      <PageHeader title={t("notifications")} subtitle={t("manage_notifications")} />

      <div className="space-y-6">
        {/* ══════════════════════════════════════════════════════════════ */}
        {/* Notification Settings (title, body, type, image)             */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              {t("send_notification")}
            </CardTitle>
            <CardDescription>
              {selectedIds.size > 0
                ? `${selectedIds.size} ${t("selected_count")}`
                : t("no_users_selected")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Type */}
              <div className="space-y-2">
                <Label>{t("notification_type")}</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>{t("notification_title")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("notification_title")}
                />
              </div>

              {/* Image */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {t("notification_image")}
                </Label>
                <Input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder={t("notification_image_hint")}
                />
              </div>

              {/* Send button */}
              <div className="space-y-2">
                <Label className="invisible">Send</Label>
                <Button
                  className="w-full"
                  onClick={handleSend}
                  disabled={selectedIds.size === 0 || !title.trim() || !body.trim() || isSending}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("sending")}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t("send_to_selected")} ({selectedIds.size})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Body — full width */}
            <div className="mt-4 space-y-2">
              <Label>{t("notification_body")}</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("notification_body")}
              />
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* Users Table with checkboxes                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle>{t("users")}</CardTitle>
            <CardDescription>
              {totalUsers} {t("users").toLowerCase()} &middot; {selectedIds.size} {t("selected_count")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("search_users_notify")}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[180px]">
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
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="p-3 text-start font-medium">{t("name")}</th>
                    <th className="p-3 text-start font-medium hidden md:table-cell">{t("email")}</th>
                    <th className="p-3 text-start font-medium">{t("role")}</th>
                    <th className="p-3 text-start font-medium">FCM</th>
                    <th className="p-3 text-start font-medium hidden lg:table-cell">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        {t("no_users")}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr
                        key={u.id}
                        className={`border-b transition-colors cursor-pointer hover:bg-muted/30 ${
                          selectedIds.has(u.id) ? "bg-primary/5" : ""
                        }`}
                        onClick={() => toggleUser(u.id)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                            checked={selectedIds.has(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-8 w-8">
                              {u.avatar && <AvatarImage src={u.avatar} alt={u.name} />}
                              <AvatarFallback className="text-xs">
                                {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{u.name}</p>
                              <p className="text-xs text-muted-foreground truncate md:hidden">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{u.email}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs capitalize">
                            {roleLabel(u.role)}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {u.hasFcm ? (
                            <div className="flex items-center gap-1.5">
                              <Bell className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-xs text-green-600 hidden sm:inline">
                                {u.fcmPlatforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <BellOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                              <span className="text-xs text-muted-foreground/50 hidden sm:inline">
                                {t("fcm_inactive")}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          <Badge variant={u.status === "active" ? "default" : "destructive"} className="text-xs">
                            {u.status === "active" ? t("status_active") : t("status_banned")}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {t("page")} {page} {t("of")} {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t("prev")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t("next")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* Saved Templates                                               */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{t("saved_templates")}</CardTitle>
              <CardDescription className="mt-1">
                {templates.length} {templates.length === 1 ? "template" : "templates"}
              </CardDescription>
            </div>
            <Button size="sm" onClick={openCreateTemplate}>
              <Plus className="mr-1 h-4 w-4" />
              {t("add_template")}
            </Button>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("no_templates")}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{tpl.name}</span>
                      <Badge variant="outline" className={typeColor(tpl.type)}>
                        {typeLabel(tpl.type)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground/80">{tpl.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tpl.body}</p>
                    <div className="flex gap-1 mt-auto pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => handleUseTemplate(tpl)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        {t("use_template")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditTemplate(tpl)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(tpl.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Template Create/Edit Dialog ────────────────────────────────── */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? t("edit_template") : t("create_template")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("template_name")}</Label>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("notification_type")}</Label>
              <Select value={tplType} onValueChange={setTplType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("notification_title")}</Label>
              <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("notification_body")}</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!tplName.trim() || !tplTitle.trim() || !tplBody.trim() || isSavingTpl}
            >
              {isSavingTpl && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
