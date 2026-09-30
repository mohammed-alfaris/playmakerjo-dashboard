import { useQuery } from "@tanstack/react-query"
import { getBookingsReport, type ReportParams } from "@/api/reports"
import { StadiumKpi } from "@/components/shared/StadiumKpi"
import { useT } from "@/i18n/LanguageContext"
import { SPORTS } from "@/lib/constants"
import type { TranslationKey } from "@/i18n/translations"
import { BarList, ChartSkeleton, DailyBars, Donut, ReportCard } from "../charts"
import { C, CHANNEL_COLORS } from "../chartColors"
import { deltaPct, deltaPoints } from "../reportLogic"
import { ReportError } from "./ReportError"

function sportLabel(key: string, lang: string) {
  const sport = SPORTS.find((s) => s.value === key)
  if (!sport) return key.charAt(0).toUpperCase() + key.slice(1)
  return lang === "ar" ? sport.labelAr : sport.label
}

/**
 * Where bookings come from and how many of them actually happen. Cancellations are split by
 * who cancelled: an app booking that expired unpaid is a payment problem, a cancellation by a
 * person is a demand problem.
 */
export default function BookingsTab({ params }: { params: ReportParams; print?: boolean }) {
  const { t, lang } = useT()
  const { data: r, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", "bookings", params],
    queryFn: () => getBookingsReport(params),
  })

  if (isError) return <ReportError onRetry={refetch} />
  const channel = (k: string) => t(`report_channel_${k}` as TranslationKey)
  const count = (n: number) => String(Math.round(n))
  const pts = t("report_points_suffix")

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StadiumKpi isLoading={isLoading} label={t("report_bookings")} value={r ? r.bookings.value : ""}
          delta={r ? deltaPct(r.bookings.value, r.bookings.previous) : null}
          sub={r ? t("report_attended_count").replace("{count}", String(r.attended)) : undefined} />
        <StadiumKpi isLoading={isLoading} label={t("report_cancel_rate")} value={r ? `${r.cancelRate.value}%` : ""}
          delta={r ? deltaPoints(r.cancelRate.value, r.cancelRate.previous) : null}
          deltaSuffix={pts} lowerIsBetter sparkColor="rose" />
        <StadiumKpi isLoading={isLoading} label={t("report_no_show_rate")} value={r ? `${r.noShowRate.value}%` : ""}
          delta={r ? deltaPoints(r.noShowRate.value, r.noShowRate.previous) : null}
          deltaSuffix={pts} lowerIsBetter sparkColor="amber"
          sub={r ? t("report_no_shows_count").replace("{count}", String(r.noShows)) : undefined} />
        <StadiumKpi isLoading={isLoading} label={t("report_cancelled")}
          value={r ? r.cancelledByPerson + r.cancelledExpired : ""}
          sub={r ? t("report_cancel_split")
            .replace("{person}", String(r.cancelledByPerson))
            .replace("{expired}", String(r.cancelledExpired)) : undefined} />
      </div>

      <ReportCard title={t("report_bookings_by_day")} hint={t("report_bookings_by_day_hint")}>
        {isLoading || !r ? <ChartSkeleton /> : (
          <DailyBars data={r.daily} format={count} series={(["app", "counter", "weekly", "series"] as const).map((k) => ({
            key: k, label: channel(k), color: CHANNEL_COLORS[k],
          }))} />
        )}
      </ReportCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <ReportCard title={t("report_by_channel")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <Donut format={count} items={r.byChannel.map((c) => ({
              key: c.key, label: channel(c.key), value: c.count, color: CHANNEL_COLORS[c.key],
            }))} />
          )}
        </ReportCard>
        <ReportCard title={t("report_lead_time")} hint={t("report_lead_time_hint")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <BarList format={count} color={C.indigo} items={r.leadTime.map((l) => ({
              key: l.key, label: t(`report_lead_${l.key}` as TranslationKey), value: l.count,
            }))} />
          )}
        </ReportCard>
        <ReportCard title={t("report_sports")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <BarList format={count} color={C.amber} items={r.sports.map((s) => ({
              key: s.key, label: sportLabel(s.key, lang), value: s.count,
            }))} />
          )}
        </ReportCard>
      </div>
    </div>
  )
}
