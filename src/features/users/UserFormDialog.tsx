import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { createUser, getUsers } from "@/api/users"
import { useRole } from "@/hooks/useRole"
import { USER_ROLES, USER_PERMISSIONS } from "@/lib/constants"
import { useT } from "@/i18n/LanguageContext"

const schema = z.object({
  name:        z.string().min(2, "Name is required"),
  email:       z.string().email("Invalid email"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  phone:       z.string().optional(),
  role:        z.string().min(1, "Role is required"),
  permissions: z.enum(["read", "write"]).optional(),
  managedByOwnerId: z.string().optional(),
}).superRefine((v, ctx) => {
  // The server refuses staff without an employer, and rightly: an unlinked staff row
  // resolves to no access anywhere, so it would be an account that can log in and see
  // nothing. Caught here so the admin is told which field, rather than getting a 400.
  if (v.role === "venue_staff" && !v.managedByOwnerId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["managedByOwnerId"], message: "Pick the owner this clerk works for" })
  }
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function UserFormDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const { isAdmin } = useRole()
  const { t, lang } = useT()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: isAdmin ? "player" : "venue_staff",
      permissions: "read",
    },
  })

  const selectedRole = watch("role")

  // Only fetched when an admin actually opens the dialog. This dialog is admin-only, but
  // the same list used to be pulled for every user who opened the VENUE form — a roster of
  // every other owner on the platform, handed out as a side effect. Keep it gated.
  const { data: ownersData } = useQuery({
    queryKey: ["users-owners"],
    queryFn: () => getUsers({ role: "venue_owner", limit: 100 }),
    enabled: isAdmin && selectedRole === "venue_staff",
  })
  const owners: Array<{ id: string; name: string }> = ownersData?.data ?? []

  // Reset permissions when role changes away from venue_staff
  useEffect(() => {
    if (selectedRole !== "venue_staff") {
      setValue("permissions", undefined)
      setValue("managedByOwnerId", undefined)
    } else {
      setValue("permissions", "read")
    }
  }, [selectedRole, setValue])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createUser({
        name:        values.name,
        email:       values.email,
        password:    values.password,
        phone:       values.phone || undefined,
        role:        values.role,
        permissions: values.role === "venue_staff" ? values.permissions : undefined,
        managedByOwnerId: values.role === "venue_staff" ? values.managedByOwnerId : undefined,
      }),
    onSuccess: () => {
      toast.success(t("user_created"))
      queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
      reset()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      if (msg?.toLowerCase().includes("email")) {
        toast.error(t("email_taken"))
      } else {
        toast.error(t("user_create_failed"))
      }
    },
  })

  // Roles available based on current user's role
  const availableRoles = isAdmin
    ? USER_ROLES
    : USER_ROLES.filter((r) => r.value === "venue_staff")

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create_user")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>{t("name")}</Label>
            <Input placeholder="John Doe" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input type="email" placeholder="user@example.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label>{t("password")}</Label>
            <Input type="password" placeholder="••••••••" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label>{t("phone")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
            <Input placeholder="+962791000000" {...register("phone")} />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>{t("role")}</Label>
            <Select
              value={selectedRole}
              onValueChange={(v) => setValue("role", v)}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {lang === "ar" ? r.labelAr : r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Permissions — only for venue_staff */}
          {selectedRole === "venue_staff" && (
            <div className="space-y-1.5">
              <Label>{t("permissions")}</Label>
              <Select
                value={watch("permissions") ?? "read"}
                onValueChange={(v) => setValue("permissions", v as "read" | "write")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_PERMISSIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {lang === "ar" ? p.labelAr : p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Which owner this clerk works for.
              Staff scope everywhere is derived from this link — an unlinked staff account
              resolves to no access at all, so it could log in and see an empty product.
              The endpoint has always required it; only the dialog never asked. */}
          {selectedRole === "venue_staff" && (
            <div className="space-y-1.5">
              <Label>{t("works_for")}</Label>
              <Select
                value={watch("managedByOwnerId") ?? ""}
                onValueChange={(v) => setValue("managedByOwnerId", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("works_for_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.managedByOwnerId && (
                <p className="text-xs text-destructive">{errors.managedByOwnerId.message}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create_user")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
