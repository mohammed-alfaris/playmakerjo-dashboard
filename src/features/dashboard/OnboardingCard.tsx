import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { CheckCircle2, Circle, X } from "lucide-react"
import { getOnboarding, type OnboardingKey } from "@/api/billing"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { cn } from "@/lib/utils"

/** Where each step is done. */
const WHERE: Record<OnboardingKey, string> = {
  venue: "/venues",
  pitches: "/venues",
  hours: "/venues",
  cliq: "/venues",
  staff: "/staff",
  first_booking: "/timeline",
  customer: "/timeline",
  standing: "/venues",
}

const DISMISS_KEY = "onboarding-dismissed"

/**
 * The owner's set-up checklist, until it is done. Worked out on the server from what exists,
 * so ticking happens by doing the thing, never by clicking a box. Hideable for owners who
 * will never use a step (no staff, no standing bookings).
 */
export function OnboardingCard() {
  const { t } = useT()
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(DISMISS_KEY) === "1" } catch { return false }
  })
  const { data } = useQuery({ queryKey: ["onboarding", "me"], queryFn: () => getOnboarding(), enabled: !dismissed })

  if (dismissed || !data || data.done === data.total) return null
  const pct = Math.round((data.done / data.total) * 100)

  return (
    <section className="rounded-[16px] border bg-card p-5 shadow-sm-stadium">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("onboarding_title")}</h2>
          <p className="text-xs text-muted-foreground">{t("onboarding_progress").replace("{done}", String(data.done)).replace("{total}", String(data.total))}</p>
        </div>
        <button
          type="button"
          aria-label={t("onboarding_hide")}
          title={t("onboarding_hide")}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            try { window.localStorage.setItem(DISMISS_KEY, "1") } catch { /* private mode: hide for now only */ }
            setDismissed(true)
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[hsl(var(--brand))]" style={{ width: `${pct}%` }} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {data.steps.map((s) => (
          <li key={s.key}>
            <Link
              to={WHERE[s.key]}
              className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2", s.done && "text-muted-foreground line-through")}
            >
              {s.done ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--brand))]" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              {t(`onboarding_${s.key}` as TranslationKey)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
