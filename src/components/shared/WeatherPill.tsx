import { cn } from "@/lib/utils"
import { useAmmanWeather } from "@/hooks/useAmmanWeather"
import { useT } from "@/i18n/LanguageContext"

export function WeatherPill({ className }: { className?: string }) {
  const { data, isPending, isError } = useAmmanWeather()
  const { t } = useT()

  if (isPending) {
    return (
      <div
        className={cn(
          "hidden sm:inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground",
          className
        )}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40" />
        <span>{t("loading")}</span>
      </div>
    )
  }

  if (isError || !data) return null

  return (
    <div
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-foreground",
        className
      )}
      title={`Amman · ${data.description}`}
    >
      <span aria-hidden>{data.emoji}</span>
      <span>{data.temperature}°C {t("amman")}</span>
    </div>
  )
}
