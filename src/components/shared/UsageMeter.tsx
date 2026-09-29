import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { formatUsage, usageRatio, type Usage } from "@/lib/permissions"

/**
 * "Venues 2 / 5" with a thin bar that turns amber near the limit and red at it. With no
 * limit it is just the count — there is nothing to fill.
 */
export function UsageMeter({
  label,
  usage,
  className,
}: {
  label: string
  usage: Usage
  className?: string
}) {
  const { t } = useT()
  const ratio = usageRatio(usage)
  const tone = usage.max == null ? "none" : ratio >= 1 ? "full" : ratio >= 0.8 ? "near" : "ok"

  return (
    <div className={cn("min-w-[120px] space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            tone === "full" && "text-destructive",
            tone === "near" && "text-amber-500",
          )}
          dir="ltr"
        >
          {formatUsage(usage)}
          {usage.max == null && <span className="ms-1 font-normal text-muted-foreground">· {t("unlimited")}</span>}
        </span>
      </div>
      {usage.max != null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              tone === "full" ? "bg-destructive" : tone === "near" ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${Math.max(ratio * 100, usage.used > 0 ? 4 : 0)}%` }}
          />
        </div>
      )}
    </div>
  )
}
