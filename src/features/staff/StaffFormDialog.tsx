import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createStaff } from "@/api/staff"
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
import { StaffAccessFields } from "./StaffAccessFields"
import { defaultRoleId, useTeamLookups, validateAccess, type StaffAccessValue } from "./teamAccess"

/**
 * Deliberately a fork of UserFormDialog rather than a reuse of it. That dialog carries a
 * role selector — disabled for owners, but still visible — and the presence of a role field
 * is exactly what makes a screen read as a platform admin tool. An owner adding their
 * evening-shift clerk should see a form about a person, not about a role in a system.
 */
const schema = z.object({
  name: z.string().min(2, "Enter their name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  phone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function StaffFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { roles, venues } = useTeamLookups()
  const blankAccess: StaffAccessValue = { staffRoleId: "", allVenues: true, venueIds: [] }
  const [picked, setAccess] = useState<StaffAccessValue>(blankAccess)
  const [accessError, setAccessError] = useState<string | null>(null)
  // Roles can arrive after the dialog opens; until the owner picks one, show the default.
  const access = { ...picked, staffRoleId: picked.staffRoleId || defaultRoleId(roles) }

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createStaff({ ...values, ...access }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      qc.invalidateQueries({ queryKey: ["staff-roles"] })
      qc.invalidateQueries({ queryKey: ["company"] })
      toast.success(t("staff_created"))
      reset()
      setAccess(blankAccess)
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      // Surface a duplicate email on the field itself rather than as a toast that
      // disappears while they are still looking at the form.
      if (message?.toLowerCase().includes("email")) {
        setError("email", { message })
      } else {
        toast.error(message ?? t("something_went_wrong"))
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("staff_add")}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((v) => {
            const bad = validateAccess(access)
            if (bad) {
              setAccessError(bad === "role" ? t("staff_role_pick") : t("staff_venues_pick"))
              return
            }
            setAccessError(null)
            mutation.mutate(v)
          })}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">{t("name")}</Label>
            <Input id="staff-name" {...register("name")} autoFocus />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-email">{t("email")}</Label>
            <Input id="staff-email" type="email" dir="ltr" {...register("email")} />
            <p className="text-xs text-muted-foreground">{t("staff_login_hint")}</p>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-password">{t("password")}</Label>
            <Input id="staff-password" type="text" dir="ltr" {...register("password")} />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-phone">{t("phone")}</Label>
            <Input id="staff-phone" type="tel" dir="ltr" placeholder="+962791000000" {...register("phone")} />
          </div>

          <StaffAccessFields
            value={access}
            onChange={setAccess}
            roles={roles}
            venues={venues}
            error={accessError}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("staff_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
