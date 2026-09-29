import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createStaffRole, updateStaffRole, type StaffRole } from "@/api/staff"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  permissionLabelKey,
  togglePermission,
  type Permission,
} from "@/lib/permissions"

/**
 * Create or edit a role. `role` null = create. Permissions are laid out by area; turning on
 * anything in an area turns on seeing it, and turning seeing off clears the area — the same
 * rule the server applies, shown up front instead of surprising the owner after saving.
 */
export default function RoleFormDialog({
  open,
  role,
  onOpenChange,
}: {
  open: boolean
  role: StaffRole | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{role ? t("role_edit") : t("role_add")}</DialogTitle>
        </DialogHeader>
        {/* Content unmounts on close, so each open starts from the role as it is now. */}
        <RoleForm role={role} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RoleForm({ role, onDone }: { role: StaffRole | null; onDone: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [name, setName] = useState(role?.name ?? "")
  // A new role starts able to see the schedule — nearly every role needs it, and an empty
  // role would be a login that opens onto nothing.
  const [permissions, setPermissions] = useState<Permission[]>(() =>
    role ? PERMISSIONS.filter((p) => role.permissions.includes(p)) : ["bookings.view"],
  )
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      role
        ? updateStaffRole(role.id, { name: name.trim(), permissions })
        : createStaffRole({ name: name.trim(), permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-roles"] })
      qc.invalidateQueries({ queryKey: ["staff"] })
      toast.success(role ? t("role_saved") : t("role_created"))
      onDone()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? t("something_went_wrong"))
    },
  })

  function save() {
    if (!name.trim()) {
      setError(t("role_name_required"))
      return
    }
    mutation.mutate()
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="role-name">{t("role_name")}</Label>
          <Input
            id="role-name"
            value={name}
            maxLength={60}
            placeholder={t("role_name_placeholder")}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>{t("role_permissions")}</Label>
          <div className="divide-y rounded-lg border">
            {PERMISSION_GROUPS.map(({ group, keys }) => (
              <div key={group} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm font-medium">{t(`perm_group_${group}` as TranslationKey)}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {keys.map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={permissions.includes(key)}
                        onChange={(e) => setPermissions((p) => togglePermission(p, key, e.target.checked))}
                      />
                      <span>{t(permissionLabelKey(key))}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("role_permissions_hint")}</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          {t("cancel")}
        </Button>
        <Button onClick={save} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {role ? t("save") : t("role_add")}
        </Button>
      </DialogFooter>
    </>
  )
}
