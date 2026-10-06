import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  generateInvoices, getOnboarding, setCompanySuspension, updateCompanyBilling, type OnboardingKey,
} from "@/api/billing"
import type { Company } from "@/api/companies"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { periodLabel, periodOptions } from "@/lib/billing"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { ammanToday } from "@/features/reports/reportLogic"

const selectClass =
  "h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * Everything PlayMaker decides about one company's account: its plan and prices, its trial,
 * a one-off invoice, and the Suspend switch. Plus how far it has got setting up — the
 * question behind most trial follow-up calls.
 */
export function CompanyBillingDialog({ company, onClose }: { company: Company | null; onClose: () => void }) {
  const { t } = useT()
  return (
    <Dialog open={!!company} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("company_billing_title").replace("{name}", company?.name ?? "")}</DialogTitle>
          <DialogDescription>{t("company_billing_hint")}</DialogDescription>
        </DialogHeader>
        {company && <Body company={company} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ company }: { company: Company }) {
  const { t, lang } = useT()
  const qc = useQueryClient()
  const b = company.billing
  const [cycle, setCycle] = useState(b.cycle)
  const [trialEndsOn, setTrialEndsOn] = useState(b.trialEndsOn ?? "")
  const [custom, setCustom] = useState(b.customPrices)
  const [small, setSmall] = useState(String(b.priceSmallVenue))
  const [large, setLarge] = useState(String(b.priceLargeVenue))
  const [waived, setWaived] = useState(b.setupFeeWaived)
  const [reason, setReason] = useState(b.suspendedReason ?? "")
  const months = periodOptions(ammanToday())
  const [period, setPeriod] = useState(months[1])

  const { data: onboarding } = useQuery({ queryKey: ["onboarding", company.id], queryFn: () => getOnboarding(company.id) })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["companies"] })
    qc.invalidateQueries({ queryKey: ["invoices"] })
  }
  const fail = (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message ?? t("something_went_wrong"))

  const save = useMutation({
    mutationFn: () => updateCompanyBilling(company.id, {
      cycle,
      trialEndsOn,
      prices: custom ? { smallVenue: Number(small), largeVenue: Number(large) } : { smallVenue: null, largeVenue: null },
      setupFeeWaived: waived,
    }),
    onSuccess: () => { toast.success(t("company_billing_saved")); refresh() },
    onError: fail,
  })
  const suspend = useMutation({
    mutationFn: (on: boolean) => setCompanySuspension(company.id, on, reason.trim() || undefined),
    onSuccess: (_, on) => { toast.success(t(on ? "company_suspended_toast" : "company_restored_toast")); refresh() },
    onError: fail,
  })
  const generate = useMutation({
    mutationFn: () => generateInvoices(period, company.id),
    onSuccess: (r) => {
      if (r.created.length > 0) toast.success(t("billing_generated").replace("{count}", "1"))
      else toast.info(t(`billing_skip_${r.skipped[0]?.reason ?? "nothing_to_bill"}` as TranslationKey))
      refresh()
    },
    onError: fail,
  })

  const suspended = b.status === "suspended"

  return (
    <div className="space-y-5">
      {onboarding && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {t("onboarding_title")} · {onboarding.done}/{onboarding.total}
          </p>
          <ul className="grid grid-cols-2 gap-1 text-xs">
            {onboarding.steps.map((s) => (
              <li key={s.key} className={cn("flex items-center gap-1.5", s.done ? "text-foreground" : "text-muted-foreground")}>
                {s.done ? <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--brand))]" /> : <Circle className="h-3.5 w-3.5" />}
                {t(`onboarding_${s.key as OnboardingKey}` as TranslationKey)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cb-cycle">{t("billing_cycle")}</Label>
          <select id="cb-cycle" className={selectClass} value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "annual")}>
            <option value="monthly">{t("billing_cycle_monthly")}</option>
            <option value="annual">{t("billing_cycle_annual")}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-trial">{t("billing_trial_ends")}</Label>
          <Input id="cb-trial" type="date" className="num" value={trialEndsOn} onChange={(e) => setTrialEndsOn(e.target.value)} />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
          {t("billing_custom_prices")}
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="cb-small">{t("billing_price_small")}</Label>
          <Input id="cb-small" type="number" min={0} step="0.5" className="num" disabled={!custom} value={small} onChange={(e) => setSmall(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-large">{t("billing_price_large").replace("{n}", String(b.largeVenueMinPitches))}</Label>
          <Input id="cb-large" type="number" min={0} step="0.5" className="num" disabled={!custom} value={large} onChange={(e) => setLarge(e.target.value)} />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} />
          {t("billing_waive_setup")}
        </label>
        <div className="col-span-2 flex justify-end">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </section>

      <section className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">{t("billing_one_invoice")}</p>
        <div className="flex gap-2">
          <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{periodLabel(m, lang)}</option>)}
          </select>
          <Button variant="outline" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {t("billing_draft")}
          </Button>
        </div>
        {b.overdueCount > 0 && (
          <p className="text-xs text-[hsl(var(--rose-ink))]">
            {t("billing_overdue_line").replace("{count}", String(b.overdueCount)).replace("{amount}", formatCurrency(b.overdueAmount))}
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-destructive/30 p-3">
        <p className="text-sm font-medium">{suspended ? t("company_suspended_title") : t("company_suspend_title")}</p>
        <p className="text-xs text-muted-foreground">{t("company_suspend_hint")}</p>
        {!suspended && (
          <Input value={reason} maxLength={255} placeholder={t("company_suspend_reason")} onChange={(e) => setReason(e.target.value)} />
        )}
        {suspended && b.suspendedReason && <p className="text-xs">{b.suspendedReason}</p>}
        <Button
          variant={suspended ? "default" : "destructive"}
          disabled={suspend.isPending}
          onClick={() => suspend.mutate(!suspended)}
        >
          {suspended ? t("company_restore") : t("company_suspend")}
        </Button>
      </section>
    </div>
  )
}
