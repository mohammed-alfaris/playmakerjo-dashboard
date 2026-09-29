import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { getMoneyReport, type ReportParams } from "@/api/reports"
import { StadiumKpi } from "@/components/shared/StadiumKpi"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { formatCurrency } from "@/lib/formatters"
import { BarList, ChartSkeleton, DailyBars, Donut, ReportCard, SimpleTable } from "../charts"
import { C, KIND_COLORS, METHOD_COLORS } from "../chartColors"
import { deltaPct, headlineMoney } from "../reportLogic"
import { ReportError } from "./ReportError"

const money = (n: number) => formatCurrency(n)
const big = (n: number) => headlineMoney(n, formatCurrency)

/**
 * Where the money came from and where it is still owed. "Collected" is the payments ledger —
 * cash actually taken — which is the number an owner reconciles against the drawer.
 */
export default function MoneyTab({ params, print = false }: { params: ReportParams; print?: boolean }) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", "money", params],
    queryFn: () => getMoneyReport(params),
  })

  if (isError) return <ReportError onRetry={refetch} />
  const r = data
  const methodLabel = (k: string) => t(`pay_method_${k}` as TranslationKey)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StadiumKpi isLoading={isLoading} label={t("report_collected")} value={r ? big(r.collected.value) : ""}
          delta={r ? deltaPct(r.collected.value, r.collected.previous) : null}
          sub={t("report_collected_hint")} />
        <StadiumKpi isLoading={isLoading} label={t("report_booked")} value={r ? big(r.booked.value) : ""}
          delta={r ? deltaPct(r.booked.value, r.booked.previous) : null} sparkColor="indigo"
          sub={t("report_booked_hint")} />
        <StadiumKpi isLoading={isLoading} label={t("report_outstanding")} value={r ? big(r.outstanding) : ""}
          sparkColor="amber"
          sub={r ? t("report_outstanding_hint").replace("{count}", String(r.outstandingCount)) : undefined} />
        {r?.platformFee && (
          <StadiumKpi label={t("report_platform_fee")} value={big(r.platformFee.value)}
            delta={deltaPct(r.platformFee.value, r.platformFee.previous)} />
        )}
        {r?.net && (
          <StadiumKpi label={t("report_net")} value={big(r.net.value)}
            delta={deltaPct(r.net.value, r.net.previous)} />
        )}
      </div>

      <ReportCard title={t("report_collected_by_day")} hint={t("report_collected_by_day_hint")}>
        {isLoading || !r ? <ChartSkeleton /> : (
          <DailyBars data={r.daily} format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))}
            series={[
              { key: "cash", label: methodLabel("cash"), color: METHOD_COLORS.cash },
              { key: "cliq", label: methodLabel("cliq"), color: METHOD_COLORS.cliq },
              { key: "other", label: methodLabel("other"), color: METHOD_COLORS.other },
            ]} />
        )}
      </ReportCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard title={t("report_how_paid")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <Donut format={money} items={r.byMethod.map((m) => ({
              key: m.key, label: methodLabel(m.key), value: m.amount, color: METHOD_COLORS[m.key],
            }))} />
          )}
        </ReportCard>
        <ReportCard title={t("report_what_paid_for")} hint={t("report_what_paid_for_hint")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <Donut format={money} items={r.byKind.map((k) => ({
              key: k.key, label: t(`pay_kind_${k.key}` as TranslationKey), value: k.amount, color: KIND_COLORS[k.key],
            }))} />
          )}
        </ReportCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard title={t("report_by_venue")}>
          {!r ? <ChartSkeleton height={160} /> : (
            <BarList format={money} items={r.byVenue.map((v) => ({
              key: v.venueId,
              label: lang === "ar" && v.nameAr ? v.nameAr : v.name,
              value: v.collected,
              sub: `${t("report_booked")}: ${money(v.booked)} · ${v.bookings} ${t("report_bookings_unit")}`,
            }))} />
          )}
        </ReportCard>
        <ReportCard title={t("report_by_pitch")} hint={t("report_by_pitch_hint")}>
          {!r ? <ChartSkeleton height={160} /> : (
            <BarList format={money} color={C.indigo} items={r.byPitch.map((p) => ({
              key: `${p.venueId}-${p.pitchId}`,
              label: `${lang === "ar" && p.pitchNameAr ? p.pitchNameAr : p.pitchName} · ${p.venueName}`,
              value: p.booked,
              sub: `${p.bookings} ${t("report_bookings_unit")}`,
            }))} />
          )}
        </ReportCard>
      </div>

      <ReportCard title={t("report_outstanding_list")} hint={t("report_outstanding_list_hint")}>
        {!r ? <ChartSkeleton height={120} /> : (
          <SimpleTable
            empty={t("report_nothing_owed")}
            columns={[
              { key: "date", label: t("date") },
              { key: "customer", label: t("report_customer") },
              { key: "venue", label: t("report_venue") },
              { key: "total", label: t("report_total"), align: "end" },
              { key: "owed", label: t("report_owed"), align: "end" },
            ]}
            rows={r.outstandingItems.slice(0, print ? 30 : 100).map((o) => ({
              key: o.bookingId,
              onClick: !print && o.customerId ? () => navigate(`/customers/${o.customerId}`) : undefined,
              cells: {
                date: <span className="num">{o.date}{o.startTime ? ` · ${o.startTime}` : ""}</span>,
                customer: o.customerName
                  ? <span>{o.customerName} <span className="text-xs text-[hsl(var(--ink-3))]" dir="ltr">{o.customerPhone}</span></span>
                  : "—",
                venue: o.venueName,
                total: money(o.total),
                owed: <span className="font-semibold text-[hsl(var(--amber-ink))]">{money(o.owed)}</span>,
              },
            }))}
          />
        )}
      </ReportCard>
    </div>
  )
}
