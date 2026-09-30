import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Receipt } from "lucide-react"
import { toast } from "sonner"
import { getSettings, updateSettings, type BillingDefaults } from "@/api/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"

const FIELDS: { key: keyof BillingDefaults; label: TranslationKey; step: string }[] = [
  { key: "priceFirstVenue", label: "billing_price_first", step: "0.5" },
  { key: "priceExtraVenue", label: "billing_price_extra", step: "0.5" },
  { key: "setupFee", label: "billing_setup_fee", step: "1" },
  { key: "trialDays", label: "billing_trial_days", step: "1" },
  { key: "paymentTermsDays", label: "billing_terms_days", step: "1" },
]

/**
 * What a company pays unless it has its own prices, and the terms every company gets. Its own
 * Save: billing is a separate decision from maintenance or limits, and saving one should not
 * send the other. The commission rate is the platform fee in the card above.
 */
export function BillingDefaultsCard() {
  const { t } = useT()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ["settings"], queryFn: getSettings })
  const current = data?.data.billing
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const values: Record<string, string> =
    draft ?? Object.fromEntries(FIELDS.map((f) => [f.key, current ? String(current[f.key]) : ""]))
  const valid = FIELDS.every((f) => values[f.key] !== "" && Number(values[f.key]) >= 0)

  const save = useMutation({
    mutationFn: () => updateSettings({
      billing: Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])) as unknown as BillingDefaults,
    }),
    onSuccess: () => {
      toast.success(t("billing_defaults_saved"))
      setDraft(null)
      qc.invalidateQueries({ queryKey: ["settings"] })
      qc.invalidateQueries({ queryKey: ["companies"] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Receipt className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{t("billing_defaults")}</h2>
          <p className="text-xs text-muted-foreground">{t("billing_defaults_hint")}</p>
        </div>
      </header>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={`bd-${f.key}`}>{t(f.label)}</Label>
            <Input
              id={`bd-${f.key}`} type="number" min={0} step={f.step} dir="ltr" className="num"
              value={values[f.key]} disabled={!current}
              onChange={(e) => setDraft({ ...values, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={!draft || !valid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
          {t("save")}
        </Button>
      </div>
    </section>
  )
}
