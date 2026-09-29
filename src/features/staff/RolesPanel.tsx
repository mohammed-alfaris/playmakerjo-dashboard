import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { deleteStaffRole, getStaffRoles, type StaffRole } from "@/api/staff"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { PERMISSION_GROUPS, permissionLabelKey } from "@/lib/permissions"
import RoleFormDialog from "./RoleFormDialog"

/**
 * The company's roles. Each card reads as a sentence of what the role may do, area by area,
 * so an owner can compare "Front desk" and "Cashier" without opening either.
 */
export default function RolesPanel() {
  const { t } = useT()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<StaffRole | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<StaffRole | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff-roles"],
    queryFn: () => getStaffRoles(),
  })
  const roles = data?.data ?? []

  const remove = useMutation({
    mutationFn: (id: string) => deleteStaffRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-roles"] })
      toast.success(t("role_deleted"))
      setDeleting(null)
    },
    onError: (err: unknown) => {
      // A role in use is refused with a 409 that says how many people hold it.
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t("something_went_wrong"))
      setDeleting(null)
    },
  })

  function openForm(role: StaffRole | null) {
    setEditing(role)
    setFormOpen(true)
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {t("something_went_wrong")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("roles_subtitle")}</p>
        <Button size="sm" onClick={() => openForm(null)}>
          <Plus className="me-1.5 h-4 w-4" />
          {t("role_add")}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {roles.map((role) => (
            <div key={role.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    <h3 className="truncate font-semibold">{role.name}</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("role_staff_count").replace("{count}", String(role.staffCount))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t("role_edit")} onClick={() => openForm(role)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title={role.staffCount > 0 ? t("role_in_use") : t("delete")}
                    disabled={role.staffCount > 0}
                    onClick={() => setDeleting(role)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                {PERMISSION_GROUPS.map(({ group, keys }) => {
                  const granted = keys.filter((k) => role.permissions.includes(k))
                  return (
                    <div key={group} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">{t(`perm_group_${group}` as TranslationKey)}</dt>
                      <dd className={granted.length ? "" : "text-muted-foreground/60"}>
                        {granted.length ? granted.map((k) => t(permissionLabelKey(k))).join(" · ") : "—"}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}
        </div>
      )}

      <RoleFormDialog open={formOpen} role={editing} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title={t("role_delete_title")}
        description={t("role_delete_body").replace("{name}", deleting?.name ?? "")}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        isLoading={remove.isPending}
        variant="destructive"
        confirmLabel={t("delete")}
      />
    </div>
  )
}
