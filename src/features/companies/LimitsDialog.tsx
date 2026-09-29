import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { updateCompany, type Company } from "@/api/companies"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/i18n/LanguageContext"
import { parseLimit } from "@/lib/permissions"

/** Set one company's venue and team limits. Empty = unlimited. */
export default function LimitsDialog({
  company,
  onOpenChange,
}: {
  company: Company | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("limits_title").replace("{name}", company?.name ?? "")}</DialogTitle>
          <DialogDescription>{t("limit_lower_hint")}</DialogDescription>
        </DialogHeader>
        {company && <LimitsForm company={company} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function LimitsForm({ company, onDone }: { company: Company; onDone: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [venues, setVenues] = useState(company.venues.max === null ? "" : String(company.venues.max))
  const [staff, setStaff] = useState(company.staff.max === null ? "" : String(company.staff.max))
  const maxVenues = parseLimit(venues)
  const maxStaff = parseLimit(staff)
  const valid = maxVenues !== "invalid" && maxStaff !== "invalid"

  const mutation = useMutation({
    mutationFn: () =>
      updateCompany(company.id, {
        limits: { maxVenues: maxVenues as number | null, maxStaff: maxStaff as number | null },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] })
      qc.invalidateQueries({ queryKey: ["company"] })
      toast.success(t("limits_saved"))
      onDone()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t("something_went_wrong"))
    },
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) mutation.mutate()
      }}
    >
      <LimitField
        id="limit-venues"
        label={t("limit_max_venues")}
        value={venues}
        onChange={setVenues}
        used={company.venues.used}
        invalid={maxVenues === "invalid"}
      />
      <LimitField
        id="limit-staff"
        label={t("limit_max_staff")}
        value={staff}
        onChange={setStaff}
        used={company.staff.used}
        invalid={maxStaff === "invalid"}
      />
      <p className="text-xs text-muted-foreground">{t("limit_empty_unlimited")}</p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={!valid || mutation.isPending}>
          {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  )
}

function LimitField({
  id,
  label,
  value,
  onChange,
  used,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  used: number
  invalid: boolean
}) {
  const { t } = useT()
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {/* What they have now, so a lower limit is set knowingly. */}
        <span className="text-xs text-muted-foreground" dir="ltr">
          {t("in_use")}: {used}
        </span>
      </div>
      <Input
        id={id}
        inputMode="numeric"
        dir="ltr"
        placeholder={t("unlimited")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && <p className="text-xs text-destructive">{t("limit_invalid")}</p>}
    </div>
  )
}
