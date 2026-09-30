import { useQuery } from "@tanstack/react-query"
import { getOccupancyReport, type OccupancyCell, type ReportParams } from "@/api/reports"
import { StadiumKpi } from "@/components/shared/StadiumKpi"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { BarList, ChartSkeleton, Empty, Heatmap, ReportCard } from "../charts"
import { C } from "../chartColors"
import { deltaPoints } from "../reportLogic"
import { ReportError } from "./ReportError"

/**
 * When the pitches are full and when they sit empty — what an owner sets prices and shifts by.
 * Occupancy is booked pitch-time over open pitch-time; half of a split pitch counts as half.
 */
export default function BusyHoursTab({ params }: { params: ReportParams; print?: boolean }) {
  const { t, lang } = useT()
  const { data: r, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", "occupancy", params],
    queryFn: () => getOccupancyReport(params),
  })

  if (isError) return <ReportError onRetry={refetch} />
  const hours = (n: number) => `${Math.round(n)} ${t("report_hours_unit")}`
  const slot = (c: OccupancyCell) =>
    `${t(`dow_${c.day}` as TranslationKey)} ${String(c.hour).padStart(2, "0")}:00`

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StadiumKpi isLoading={isLoading} label={t("report_occupancy")} value={r ? `${r.occupancy.value}%` : ""}
          delta={r ? deltaPoints(r.occupancy.value, r.occupancy.previous) : null}
          deltaSuffix={t("report_points_suffix")} />
        <StadiumKpi isLoading={isLoading} label={t("report_booked_hours")} value={r ? Math.round(r.bookedHours) : ""}
          sparkColor="indigo" />
        <StadiumKpi isLoading={isLoading} label={t("report_open_hours")} value={r ? Math.round(r.openHours) : ""}
          sparkColor="amber" sub={t("report_open_hours_hint")} />
      </div>

      <ReportCard title={t("report_heatmap")} hint={t("report_heatmap_hint")}>
        {isLoading || !r ? <ChartSkeleton height={260} /> : <Heatmap grid={r.grid} />}
      </ReportCard>

      <div className="grid gap-5 lg:grid-cols-3">
        <ReportCard title={t("report_busiest")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <BarList format={(n) => `${Math.round(n)}%`} max={100} items={r.busiest.map((c) => ({
              key: `${c.day}-${c.hour}`, label: slot(c), value: c.pct ?? 0,
            }))} />
          )}
        </ReportCard>
        <ReportCard title={t("report_quietest")} hint={t("report_quietest_hint")}>
          {!r ? <ChartSkeleton height={150} /> : (
            <BarList format={(n) => `${Math.round(n)}%`} max={100} color={C.amber} items={r.quietest.map((c) => ({
              key: `${c.day}-${c.hour}`, label: slot(c), value: c.pct ?? 0,
            }))} />
          )}
        </ReportCard>
        <ReportCard title={t("report_by_pitch")}>
          {!r ? <ChartSkeleton height={150} /> : r.byPitch.length === 0 ? <Empty /> : (
            <BarList format={(n) => `${Math.round(n)}%`} max={100} color={C.indigo} items={r.byPitch.map((p) => ({
              key: `${p.venueId}-${p.pitchId}`,
              label: `${lang === "ar" && p.pitchNameAr ? p.pitchNameAr : p.pitchName} · ${p.venueName}`,
              value: p.pct ?? 0,
              sub: `${hours(p.bookedHours)} / ${hours(p.openHours)}`,
            }))} />
          )}
        </ReportCard>
      </div>
    </div>
  )
}
