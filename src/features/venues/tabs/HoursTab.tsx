import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"
import type { DayHours, DayOfWeek } from "@/lib/types"
import type { Venue } from "@/api/venues"

// ---------------------------------------------------------------------------
// Hours tab — operating hours display with today highlight
// ---------------------------------------------------------------------------

const DAY_ORDER: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

export function HoursTab({ venue }: { venue: Venue }) {
  const { t } = useT()
  const oh = venue.operatingHours ?? {}
  const todayIdx = (new Date().getDay() + 6) % 7 // Sunday = 6 => Sunday at end
  return (
    <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] overflow-hidden">
      <ul>
        {DAY_ORDER.map((day, i) => {
          const dh: DayHours | undefined = oh[day]
          const isToday = i === todayIdx
          const closed = !dh || dh.closed || !dh.open || !dh.close
          return (
            <li
              key={day}
              className={cn(
                "flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--line))] last:border-b-0 text-[13px]",
                isToday && "bg-[hsl(var(--brand-tint))]",
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  isToday ? "text-[hsl(var(--brand-ink))]" : "text-[hsl(var(--ink))]",
                )}
              >
                {t(day)}
                {isToday && (
                  <span className="ms-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
                    {t("today")}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "mono",
                  closed
                    ? "text-[hsl(var(--rose-ink))]"
                    : isToday
                      ? "text-[hsl(var(--brand-ink))]"
                      : "text-[hsl(var(--ink-2))]",
                )}
              >
                {closed ? t("closed") : `${dh!.open} – ${dh!.close}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
