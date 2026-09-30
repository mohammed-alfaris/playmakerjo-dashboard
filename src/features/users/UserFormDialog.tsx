import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getCompanies, updateCompany, type Company } from "@/api/companies"
import { createUser } from "@/api/users"
import { UsageMeter } from "@/components/shared/UsageMeter"
import { StaffAccessFields } from "@/features/staff/StaffAccessFields"
import { defaultRoleId, useTeamLookups, validateAccess, type StaffAccessValue } from "@/features/staff/teamAccess"
import { USER_ROLES } from "@/lib/constants"
import { isAtLimit } from "@/lib/permissions"
import { useT } from "@/i18n/LanguageContext"

const schema = z.object({
  name:        z.string().min(2, "Name is required"),
  email:       z.string().email("Invalid email"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  phone:       z.string().optional(),
  role:        z.string().min(1, "Role is required"),
  managedByOwnerId: z.string().optional(),
  companyName: z.string().max(120).optional(),
  companyNameAr: z.string().max(120).optional(),
}).superRefine((v, ctx) => {
  // The server refuses staff without a company, and rightly: an unlinked staff row
  // resolves to no access anywhere, so it would be an account that can log in and see
  // nothing. Caught here so the admin is told which field, rather than getting a 400.
  if (v.role === "venue_staff" && !v.managedByOwnerId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["managedByOwnerId"], message: "Pick the company this person works for" })
  }
})

type FormValues = z.infer<typeof schema>

/** Fields to start from — a sales lead becoming an owner arrives already filled in. */
export interface UserFormInitial {
  name?: string
  email?: string
  phone?: string
  role?: string
  companyName?: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: UserFormInitial
  /** Called with the new account's id once it exists. */
  onCreated?: (userId: string) => void
}

/**
 * Admin: create any account. What else it asks follows the role, because the role decides
 * where the person belongs:
 *   - staff belong to a company — pick it, then one of its roles and its venues;
 *   - an owner IS a company — name it (it would otherwise take the owner's name);
 *   - players and admins belong to none.
 */
export function UserFormDialog({ open, onOpenChange, initial, onCreated }: Props) {
  const { t } = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("create_user")}</DialogTitle>
        </DialogHeader>
        {/* Content unmounts on close, so every open starts from a blank form. */}
        <UserForm initial={initial} onCreated={onCreated} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function UserForm({ onDone, initial, onCreated }: { onDone: () => void; initial?: UserFormInitial; onCreated?: (userId: string) => void }) {
  const queryClient = useQueryClient()
  const { t, lang } = useT()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "player", ...initial },
  })

  const role = watch("role")
  const companyId = watch("managedByOwnerId") ?? ""

  const { data: companiesData } = useQuery({
    queryKey: ["companies", "user-dialog"],
    queryFn: () => getCompanies({ limit: 100 }),
    enabled: role === "venue_staff",
  })
  const companies: Company[] = companiesData?.data ?? []
  const company = companies.find((c) => c.id === companyId)
  const companyFull = isAtLimit(company?.staff)

  const { roles, venues } = useTeamLookups(role === "venue_staff" ? companyId : "")
  const [picked, setAccess] = useState<StaffAccessValue>({ staffRoleId: "", allVenues: true, venueIds: [] })
  const [accessError, setAccessError] = useState<string | null>(null)
  // Roles arrive after the company is picked; until one is chosen, show the company's default.
  const access = { ...picked, staffRoleId: picked.staffRoleId || defaultRoleId(roles) }

  function pickCompany(id: string) {
    setValue("managedByOwnerId", id, { shouldValidate: true })
    // Another company's roles and venues are not this one's.
    setAccess({ staffRoleId: "", allVenues: true, venueIds: [] })
    setAccessError(null)
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const isStaff = values.role === "venue_staff"
      const res = await createUser({
        name:     values.name,
        email:    values.email,
        password: values.password,
        phone:    values.phone || undefined,
        role:     values.role,
        ...(isStaff ? {
          managedByOwnerId: values.managedByOwnerId,
          staffRoleId: access.staffRoleId || undefined,
          allVenues: access.allVenues,
          venueIds: access.allVenues ? undefined : access.venueIds,
        } : {}),
      })
      // Creating an owner creates their company, named after them. Rename it straight away
      // when a company name was given — a second call, so a failure here still leaves the
      // account created, which is said plainly rather than hidden.
      const name = values.companyName?.trim()
      const nameAr = values.companyNameAr?.trim()
      if (values.role === "venue_owner" && (name || nameAr)) {
        try {
          await updateCompany(res.data.id, { name: name || undefined, nameAr: nameAr || undefined })
        } catch {
          toast.warning(t("company_name_not_saved"))
        }
      }
      return res
    },
    onSuccess: (res) => {
      onCreated?.(res.data.id)
      toast.success(t("user_created"))
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["companies"] })
      onDone()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      // The server's reason is the useful part — "this account allows 5 active staff" says
      // what to do; "failed to create user" does not.
      toast.error(msg?.toLowerCase().includes("email") ? t("email_taken") : msg ?? t("user_create_failed"))
    },
  })

  function onSubmit(values: FormValues) {
    if (values.role === "venue_staff") {
      const bad = validateAccess(access)
      if (bad) {
        setAccessError(bad === "role" ? t("staff_role_pick") : t("staff_venues_pick"))
        return
      }
    }
    mutation.mutate(values)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label>{t("name")}</Label>
        <Input placeholder="John Doe" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>{t("email")}</Label>
        <Input type="email" dir="ltr" placeholder="user@example.com" {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>{t("password")}</Label>
        <Input type="password" placeholder="••••••••" {...register("password")} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>{t("phone")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
        <Input dir="ltr" placeholder="+962791000000" {...register("phone")} />
      </div>

      {/* The kind of account, not a role inside a company — that one is picked after the
          company, from that company's own roles. */}
      <div className="space-y-1.5">
        <Label>{t("account_type")}</Label>
        <Select value={role} onValueChange={(v) => setValue("role", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {lang === "ar" ? r.labelAr : r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {role === "venue_owner" && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{t("new_owner_company_hint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="new-company-name">{t("company_name")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
            <Input id="new-company-name" maxLength={120} placeholder={t("company_name_defaults")} {...register("companyName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-company-name-ar">{t("company_name_ar")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
            <Input id="new-company-name-ar" dir="rtl" maxLength={120} {...register("companyNameAr")} />
          </div>
        </div>
      )}

      {role === "venue_staff" && (
        <>
          <div className="space-y-1.5">
            <Label>{t("company")}</Label>
            <Select value={companyId} onValueChange={pickCompany}>
              <SelectTrigger>
                <SelectValue placeholder={t("pick_company")} />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {lang === "ar" && c.nameAr ? c.nameAr : c.name}
                    {c.name !== c.ownerName && <span className="text-muted-foreground"> · {c.ownerName}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.managedByOwnerId && (
              <p className="text-xs text-destructive">{errors.managedByOwnerId.message}</p>
            )}
            {company && <UsageMeter label={t("usage_staff")} usage={company.staff} className="pt-1" />}
            {companyFull && company && (
              <p className="text-xs text-amber-500" role="status">
                {t("company_staff_full").replace("{max}", String(company.staff.max))}
              </p>
            )}
          </div>

          {companyId && (
            <StaffAccessFields value={access} onChange={setAccess} roles={roles} venues={venues} error={accessError} />
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting || mutation.isPending || (role === "venue_staff" && companyFull)}>
          {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("create_user")}
        </Button>
      </div>
    </form>
  )
}
