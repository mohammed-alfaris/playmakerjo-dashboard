import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ArrowLeft, MessageCircle, Loader2 } from "lucide-react"
import {
  getCustomerReport,
  whatsappLink,
  type TopCustomerItem,
} from "@/api/customers"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"
import { formatDate } from "@/lib/formatters"

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-1.5 num text-2xl font-semibold " +
          (tone === "warn" ? "text-amber-ink" : tone === "good" ? "text-brand-ink" : "text-foreground")
        }
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function PersonRow({ person, showDaysAway }: { person: TopCustomerItem; showDaysAway?: boolean }) {
  const { t } = useT()
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{person.name || t("walk_in_customer")}</div>
        <div className="truncate text-xs text-muted-foreground" dir="ltr">
          {person.phone}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-end">
          {showDaysAway ? (
            <>
              <div className="text-sm font-semibold text-amber-ink">
                {t("customer_last_seen").replace("{n}", String(person.daysSinceLastVisit))}
              </div>
              <div className="text-xs text-muted-foreground">
                {person.lastVisit ? formatDate(person.lastVisit) : "—"}
              </div>
            </>
          ) : (
            <>
              <div className="num text-sm font-semibold">{person.visits}</div>
              <div className="text-xs text-muted-foreground">
                {t("report_lifetime").replace("{n}", String(person.lifetimeVisits))}
              </div>
            </>
          )}
        </div>
        {/* Sent from the owner's own WhatsApp, from his own relationship. */}
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={whatsappLink(person.phone, "")} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            {t("customer_whatsapp")}
          </a>
        </Button>
      </div>
    </div>
  )
}

export default function CustomerReportPage() {
  const { t } = useT()
  const [month, setMonth] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ["customer-report", month],
    queryFn: () => getCustomerReport(month),
  })

  const maxTrend = Math.max(
    1,
    ...(data?.trend.map((p) => p.newCustomers + p.returningCustomers) ?? [1]),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("report_customers_title")}
        subtitle={t("report_customers_subtitle")}
        action={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/customers">
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t("nav_customers")}
            </Link>
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("report_active")} value={String(data.active)} hint={t("report_active_hint")} />
            <Stat label={t("report_new")} value={String(data.newCustomers)} hint={t("report_new_hint")} />
            <Stat
              label={t("report_returning")}
              value={String(data.returning)}
              hint={`${data.returnRate}%`}
              tone="good"
            />
            <Stat
              label={t("report_lapsed")}
              value={String(data.lapsedCount)}
              hint={t("report_lapsed_hint")}
              tone={data.lapsedCount > 0 ? "warn" : undefined}
            />
          </div>

          {/* Six months of new vs returning. The shape is the point: a bar that is all
              new-customer colour month after month means people are not coming back, and
              no single number would show that. */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-semibold">{t("report_trend")}</div>
            <div className="mt-4 flex items-end gap-3">
              {data.trend.map((p) => {
                const total = p.newCustomers + p.returningCustomers
                const h = Math.round((total / maxTrend) * 100)
                const returningShare = total === 0 ? 0 : (p.returningCustomers / total) * 100
                return (
                  <div key={p.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="text-[10px] text-muted-foreground">{total || ""}</div>
                    <div
                      className="flex w-full flex-col justify-end overflow-hidden rounded-md bg-muted/40"
                      style={{ height: 96 }}
                    >
                      <div style={{ height: `${h}%` }} className="flex flex-col justify-end">
                        <div
                          className="w-full bg-brand"
                          style={{ height: `${returningShare}%` }}
                          title={t("report_returning")}
                        />
                        <div
                          className="w-full bg-brand/35"
                          style={{ height: `${100 - returningShare}%` }}
                          title={t("report_new")}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMonth(p.month)}
                      className={
                        "text-[10px] transition-colors " +
                        (p.month === data.month
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {p.month.slice(5)}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-brand" /> {t("report_returning")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-brand/35" /> {t("report_new")}
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">{t("report_top")}</div>
              <div className="mt-3 space-y-1.5">
                {data.topCustomers.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  data.topCustomers.map((p) => <PersonRow key={p.id} person={p} />)
                )}
              </div>
            </div>

            {/* The one that makes money. */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold">{t("report_winback")}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t("report_winback_hint")}</div>
              <div className="mt-3 space-y-1.5">
                {data.lapsed.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("report_nobody_lost")}</div>
                ) : (
                  data.lapsed.map((p) => <PersonRow key={p.id} person={p} showDaysAway />)
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
