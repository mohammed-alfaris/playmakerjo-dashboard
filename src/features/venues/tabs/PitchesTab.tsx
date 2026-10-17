import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/shared/design/Chip"
import { useT } from "@/i18n/LanguageContext"
import { sizeLabel, sportName } from "@/lib/dayLabels"
import { formatCurrency } from "@/lib/formatters"
import type { Pitch } from "@/api/venues"

// ---------------------------------------------------------------------------
// Pitches tab — pitch table with name, sport, size, price
// ---------------------------------------------------------------------------

export function PitchesTab({ pitches, onEdit }: { pitches: Pitch[]; onEdit: () => void }) {
  const { t, lang } = useT()
  if (pitches.length === 0) {
    return (
      <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] p-8 text-center text-sm text-[hsl(var(--ink-3))]">
        {t("profile_no_pitches")}
      </div>
    )
  }
  return (
    <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-5 py-3 border-b border-[hsl(var(--line))] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
        <span>{t("pitch") ?? "Pitch"}</span>
        <span>{t("sport")}</span>
        <span>{t("pitch_size") ?? "Size"}</span>
        <span>{t("price_per_hour")}</span>
        <span />
      </div>
      <ul>
        {pitches.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-5 py-3 border-b border-[hsl(var(--line))] last:border-b-0 text-[13px]"
          >
            <div>
              <div className="font-semibold text-[hsl(var(--ink))]">{p.name}</div>
              {p.subSizes && p.subSizes.length > 0 && (
                <div className="mt-0.5 text-[11px] text-[hsl(var(--ink-3))]">
                  {t("profile_pitch_split")}:{" "}
                  {[p.parentSize, ...p.subSizes].filter((x): x is string => !!x).map((x) => sizeLabel(t, x)).join(" / ")}
                </div>
              )}
            </div>
            <Chip color="brand" size="sm">
              {sportName(p.sport, lang)}
            </Chip>
            <span className="mono text-[12px] text-[hsl(var(--ink-2))]">
              {p.parentSize ? sizeLabel(t, p.parentSize) : "—"}
            </span>
            <span className="mono text-[12px] font-semibold text-[hsl(var(--ink))]">
              {formatCurrency(p.pricePerHour)}
            </span>
            <Button size="sm" variant="ghost" className="gap-1" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
              {t("edit")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
