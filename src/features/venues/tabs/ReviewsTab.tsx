import { Star } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useT } from "@/i18n/LanguageContext"
import { formatDate } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { Review } from "@/api/reviews"

// ---------------------------------------------------------------------------
// Reviews tab — reviews list with ratings
// ---------------------------------------------------------------------------

export function ReviewsTab({ reviews, isLoading }: { reviews: Review[]; isLoading: boolean }) {
  const { t } = useT()
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[12px]" />
        ))}
      </div>
    )
  }
  if (reviews.length === 0) {
    return (
      <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] p-8 text-center text-sm text-[hsl(var(--ink-3))]">
        {t("profile_no_reviews")}
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-[14px] bg-card border border-[hsl(var(--line))] p-4 shadow-sm-stadium"
        >
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-full bg-[hsl(var(--surface-2))] bg-cover bg-center shrink-0 overflow-hidden"
              style={
                r.playerAvatar
                  ? { backgroundImage: `url(${r.playerAvatar})` }
                  : undefined
              }
            >
              {!r.playerAvatar && (
                <div className="flex h-full items-center justify-center text-[12px] font-semibold text-[hsl(var(--ink-3))]">
                  {r.playerName?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-[hsl(var(--ink))] text-[13.5px] truncate">
                  {r.playerName}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3 w-3",
                        i < r.rating
                          ? "text-[hsl(var(--amber))] fill-[hsl(var(--amber))]"
                          : "text-[hsl(var(--ink-3))]",
                      )}
                    />
                  ))}
                </div>
              </div>
              {r.comment && (
                <p className="mt-1 text-[13px] text-[hsl(var(--ink-2))] leading-relaxed">
                  {r.comment}
                </p>
              )}
              <div className="mt-1.5 mono text-[10.5px] text-[hsl(var(--ink-3))]">
                {formatDate(r.createdAt)}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
