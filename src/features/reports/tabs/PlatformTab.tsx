import { useQuery } from "@tanstack/react-query"
import { getPlatformReport, type ReportParams } from "@/api/reports"
import { StadiumKpi } from "@/components/shared/StadiumKpi"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { ChartSkeleton, DailyBars, ReportCard, SimpleTable } from "../charts"
import { C } from "../chartColors"
import { deltaPct, deltaPoints, headlineMoney } from "../reportLogic"
import { ReportError } from "./ReportError"

const money = (n: number) => formatCurrency(n)
const big = (n: number) => headlineMoney(n, formatCurrency)

/**
 * PlayMaker's own view: the whole platform, how it grows, and every company side by side.
 * Clicking a company opens its business view with the same period.
 */
export default function PlatformTab({
  params,
  onOpenCompany,
  print = false,
}: {
  params: ReportParams
  onOpenCompany?: (ownerId: string) => void
  print?: boolean
}) {
  const { t, lang } = useT()
  const { data: r, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", "platform", params.from, params.to, params.compare],
    queryFn: () => getPlatformReport(params),
  })

  if (isError) return <ReportError onRetry={refetch} />

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StadiumKpi isLoading={isLoading} label={t("report_booked")} value={r ? big(r.booked.value) : ""}
          delta={r ? deltaPct(r.booked.value, r.booked.previous) : null} />
        <StadiumKpi isLoading={isLoading} label={t("report_platform_fee")} value={r ? big(r.fee.value) : ""}
          delta={r ? deltaPct(r.fee.value, r.fee.previous) : null} sparkColor="amber" />
        <StadiumKpi isLoading={isLoading} label={t("report_collected")} value={r ? big(r.collected.value) : ""}
          delta={r ? deltaPct(r.collected.value, r.collected.previous) : null} sparkColor="indigo" />
        <StadiumKpi isLoading={isLoading} label={t("report_bookings")} value={r ? r.bookings.value : ""}
          delta={r ? deltaPct(r.bookings.value, r.bookings.previous) : null} />
        <StadiumKpi isLoading={isLoading} label={t("report_app_share")} value={r ? `${r.appShare.value}%` : ""}
          delta={r ? deltaPoints(r.appShare.value, r.appShare.previous) : null} deltaSuffix={t("report_points_suffix")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StadiumKpi isLoading={isLoading} label={t("report_active_companies")} value={r ? r.activeCompanies.value : ""}
          delta={r ? deltaPct(r.activeCompanies.value, r.activeCompanies.previous) : null} />
        <StadiumKpi isLoading={isLoading} label={t("report_new_companies")} value={r ? r.newCompanies.value : ""}
          delta={r ? deltaPct(r.newCompanies.value, r.newCompanies.previous) : null} sparkColor="indigo" />
        <StadiumKpi isLoading={isLoading} label={t("report_new_venues")} value={r ? r.newVenues.value : ""}
          delta={r ? deltaPct(r.newVenues.value, r.newVenues.previous) : null} sparkColor="indigo" />
        <StadiumKpi isLoading={isLoading} label={t("report_new_players")} value={r ? r.newPlayers.value : ""}
          delta={r ? deltaPct(r.newPlayers.value, r.newPlayers.previous) : null} sparkColor="indigo" />
      </div>

      {/* Two charts, not one: the fee is a few percent of the booked value, so on a shared
          scale its bars would be too small to see. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportCard title={t("report_booked_by_day")}>
          {isLoading || !r ? <ChartSkeleton /> : (
            <DailyBars data={r.daily} series={[{ key: "booked", label: t("report_booked"), color: C.brand }]} />
          )}
        </ReportCard>
        <ReportCard title={t("report_fee_by_day")}>
          {isLoading || !r ? <ChartSkeleton /> : (
            <DailyBars data={r.daily} series={[{ key: "fee", label: t("report_platform_fee"), color: C.amber }]} />
          )}
        </ReportCard>
      </div>

      <ReportCard title={t("report_companies")} hint={print ? undefined : t("report_companies_hint")}>
        {!r ? <ChartSkeleton height={200} /> : (
          <SimpleTable
            columns={[
              { key: "name", label: t("company") },
              { key: "status", label: t("status") },
              { key: "venues", label: t("usage_venues"), align: "end" },
              { key: "bookings", label: t("report_bookings"), align: "end" },
              { key: "booked", label: t("report_booked"), align: "end" },
              { key: "fee", label: t("report_platform_fee"), align: "end" },
              { key: "collected", label: t("report_collected"), align: "end" },
            ]}
            rows={r.companies.map((c) => ({
              key: c.ownerId,
              onClick: onOpenCompany && !print ? () => onOpenCompany(c.ownerId) : undefined,
              cells: {
                name: <span className="font-medium">{lang === "ar" && c.nameAr ? c.nameAr : c.name}</span>,
                status: <StatusBadge status={c.ownerStatus} />,
                venues: c.venues,
                bookings: c.bookings,
                booked: money(c.booked),
                fee: money(c.fee),
                collected: money(c.collected),
              },
            }))}
          />
        )}
      </ReportCard>
    </div>
  )
}
