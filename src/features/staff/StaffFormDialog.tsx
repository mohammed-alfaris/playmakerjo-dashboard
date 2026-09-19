import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { createStaff, type StaffPermission } from "@/api/staff"
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
  permissions: z.enum(["read", "write"]),
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
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // "read", matching the API's own default when the field is absent
    // (UsersController.cs: req.Permissions ?? "read"). The two used to disagree, and the
    // failure modes are not symmetric: a clerk who cannot click something says so within
    // the hour, while a clerk silently granted write says nothing at all.
    defaultValues: { permissions: "read" },
  })

  const permissions = watch("permissions")

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createStaff(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      toast.success(t("staff_created"))
      reset({ permissions: "read" })
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("staff_add")}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
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

          <div className="space-y-2">
            <Label>{t("staff_permission")}</Label>
            <div className="grid gap-2">
              {(["write", "read"] as StaffPermission[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setValue("permissions", level)}
                  className={
                    "rounded-lg border p-3 text-start transition-colors " +
                    (permissions === level
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40")
                  }
                >
                  <div className="text-sm font-medium">
                    {level === "write"
                      ? t("staff_permission_write")
                      : t("staff_permission_read")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {level === "write"
                      ? t("staff_permission_write_hint")
                      : t("staff_permission_read_hint")}
                  </div>
                </button>
              ))}
            </div>
          </div>

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
