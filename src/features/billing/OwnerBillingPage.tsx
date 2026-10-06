import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileText } from "lucide-react"
import { getInvoices } from "@/api/billing"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { useMyCompany } from "@/hooks/useMyCompany"
import { useT } from "@/i18n/LanguageContext"
import { periodLabel } from "@/lib/billing"
import { formatCurrency } from "@/lib/formatters"
import { InvoiceBadge } from "./InvoiceBadge"
import { InvoiceDialog } from "./InvoiceDialog"

/**
 * The owner's side of billing: where they stand (trial, plan, prices) and every invoice
 * PlayMaker has issued them. Reachable even while suspended — paying is how that ends.
 */
export default function OwnerBillingPage() {
  const { t, lang } = useT()
  const [open, setOpen] = useState<string | null>(null)
  const company = useMyCompany()
  const { data, isLoading } = useQuery({ queryKey: ["invoices", "mine"], queryFn: () => getInvoices({ limit: 100 }) })
  const b = company?.billing
  const invoices = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_billing")} subtitle={t("billing_owner_subtitle")} />

      {b && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t("billing_plan")} value={
            b.status === "trial" && b.trialEndsOn
              ? t("billing_trial_until").replace("{date}", b.trialEndsOn)
              : b.status === "suspended" ? t("billing_status_suspended")
              : b.cycle === "annual" ? t("billing_cycle_annual") : t("billing_cycle_monthly")
          } />
          <Stat label={t("billing_price")} value={t("billing_price_value")
            .replace("{small}", formatCurrency(b.priceSmallVenue))
            .replace("{large}", formatCurrency(b.priceLargeVenue))
            .replace("{n}", String(b.largeVenueMinPitches))} />
          <Stat
            label={t("invoice_state_overdue")}
            value={b.overdueCount > 0 ? formatCurrency(b.overdueAmount) : t("billing_nothing_overdue")}
            warn={b.overdueCount > 0}
          />
        </div>
      )}

      <div className="rounded-[14px] border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">…</p>}
        {!isLoading && invoices.length === 0 && (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><FileText className="h-4 w-4" />{t("billing_no_invoices")}</p>
        )}
        <ul>
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium">{periodLabel(inv.period, lang)} <span className="num ms-1 text-xs text-muted-foreground">{inv.number}</span></p>
                {inv.dueOn && inv.status === "issued" && (
                  <p className="text-xs text-muted-foreground">{t("invoice_due").replace("{date}", inv.dueOn)}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-sm font-semibold">{formatCurrency(inv.total)}</span>
                <InvoiceBadge invoice={inv} />
                <Button variant="ghost" size="sm" onClick={() => setOpen(inv.id)}>{t("action_open")}</Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">{t("billing_how_to_pay")}</p>

      <InvoiceDialog invoiceId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-[14px] border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p className={warn ? "mt-1 text-base font-semibold text-[hsl(var(--rose-ink))]" : "mt-1 text-base font-semibold"}>{value}</p>
    </div>
  )
}
