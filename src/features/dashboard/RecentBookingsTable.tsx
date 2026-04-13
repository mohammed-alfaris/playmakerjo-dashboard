import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { getBookings } from "@/api/bookings"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

// ─── Sport colors ─────────────────────────────────────────────────────────────
const SPORT_COLORS: Record<string, string> = {
  football:   "#22c55e",
  basketball: "#f97316",
  tennis:     "#eab308",
  swimming:   "#3b82f6",
  volleyball: "#a855f7",
  cricket:    "#14b8a6",
  padel:      "#ec4899",
  squash:     "#6366f1",
}
function sportColor(sport: string) {
  return SPORT_COLORS[sport.toLowerCase()] ?? "#94a3b8"
}

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(dateStr: string, justNow: string, mAgo: string, hAgo: string, yesterday: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1)  return justNow
  if (mins < 60) return `${mins}${mAgo}`
  if (hours < 24) return `${hours}${hAgo}`
  if (days === 1) return yesterday
  return new Date(dateStr).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: string
  venue: { name: string }
  player: { name: string }
  sport: string
  date: string
  amount: number
  status: string
}

interface RecentBookingsTableProps {
  ownerFilter?: { owner_id?: string }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RecentBookingsTable({ ownerFilter = {} }: RecentBookingsTableProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["recent-bookings", ownerFilter],
    queryFn: () => getBookings({ limit: 10, sort: "latest", ...ownerFilter }),
  })
  const { t } = useT()

  const bookings: Booking[] = data?.data ?? []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{t("recent_bookings")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {t("failed_load_bookings")}
          </p>
        ) : bookings.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {t("no_bookings_found")}
          </p>
        ) : (
          <div className="divide-y">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                {/* Sport color dot */}
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: sportColor(b.sport) }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {b.player.name}
                    <span className="text-muted-foreground font-normal"> · {b.venue.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">
                    {b.sport} · {relativeTime(b.date, t("just_now"), t("minutes_ago"), t("hours_ago"), t("yesterday"))}
                  </p>
                </div>

                {/* Amount + status */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(b.amount)}</span>
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
