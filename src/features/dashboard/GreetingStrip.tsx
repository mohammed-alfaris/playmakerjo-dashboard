import { useAuth } from "@/hooks/useAuth"
import { useT } from "@/i18n/LanguageContext"

function greetingKey(hour: number): "greeting_morning" | "greeting_afternoon" | "greeting_evening" {
  if (hour < 12) return "greeting_morning"
  if (hour < 18) return "greeting_afternoon"
  return "greeting_evening"
}

export function GreetingStrip() {
  const { user } = useAuth()
  const { t, lang } = useT()

  const now = new Date()
  const firstName = user?.name?.split(" ")[0] ?? ""

  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const dateStr = now.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
      <div>
        <h1 className="text-display-md font-display text-foreground">
          {t(greetingKey(now.getHours()))}
          {firstName ? `, ${firstName}` : ""} <span aria-hidden>👋</span>
        </h1>
        <p className="text-sm text-muted-foreground">{dateStr}</p>
      </div>
    </div>
  )
}
