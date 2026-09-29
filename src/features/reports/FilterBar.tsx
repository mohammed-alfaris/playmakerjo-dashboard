import { useQuery } from "@tanstack/react-query"
import { GitCompareArrows } from "lucide-react"
import { getCompanies } from "@/api/companies"
import { getVenues, type Venue } from "@/api/venues"
import { Segmented } from "@/components/shared/design/Segmented"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { cn } from "@/lib/utils"
import { PRESETS, presetRange, previousPeriod, type PresetKey, type ReportFilters } from "./reportLogic"

const ALL = "__all__"

function rangeLabel(from: string, to: string, lang: string) {
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const f = fmt.format(new Date(`${from}T00:00:00Z`))
  return from === to ? f : `${f} – ${fmt.format(new Date(`${to}T00:00:00Z`))}`
}

export function FilterBar({ filters, update }: { filters: ReportFilters; update: (patch: Partial<ReportFilters>) => void }) {
  const { t, lang } = useT()
  const { isAdmin } = useRole()

  const { data: companies } = useQuery({
    queryKey: ["companies", "report-picker"],
    queryFn: () => getCompanies({ limit: 100 }),
    enabled: isAdmin,
  })
  // The venue list follows the company picked; for owners and staff the API scopes it anyway.
  const { data: venues } = useQuery({
    queryKey: ["report-venues", filters.company],
    queryFn: () => getVenues({ limit: 100, ...(filters.company ? { owner_id: filters.company } : {}) }) as Promise<{ data: Venue[] }>,
    enabled: !isAdmin || !!filters.company,
  })

  const prev = previousPeriod(filters.from, filters.to)

  return (
    <div className="space-y-3 rounded-[14px] border border-[hsl(var(--line))] bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<PresetKey>
          value={filters.preset}
          onChange={(p) => update(p === "custom" ? { preset: p } : { preset: p, ...presetRange(p) })}
          options={[
            ...PRESETS.map((p) => ({ value: p, label: t(`report_preset_${p}` as TranslationKey) })),
            { value: "custom" as const, label: t("report_preset_custom") },
          ]}
        />
        {filters.preset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" className="h-8 w-[150px]" value={filters.from} max={filters.to}
              onChange={(e) => e.target.value && update({ from: e.target.value })} aria-label={t("report_from")} />
            <span className="text-[hsl(var(--ink-3))]">→</span>
            <Input type="date" className="h-8 w-[150px]" value={filters.to} min={filters.from}
              onChange={(e) => e.target.value && update({ to: e.target.value })} aria-label={t("report_to")} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <Select value={filters.company || ALL} onValueChange={(v) => update({ company: v === ALL ? "" : v, venue: "", tab: v === ALL ? "platform" : filters.tab === "platform" ? "money" : filters.tab })}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("report_all_companies")}</SelectItem>
              {(companies?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{lang === "ar" && c.nameAr ? c.nameAr : c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(!isAdmin || filters.company) && (
          <Select value={filters.venue || ALL} onValueChange={(v) => update({ venue: v === ALL ? "" : v })}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("report_all_venues")}</SelectItem>
              {(venues?.data ?? []).map((v) => (
                <SelectItem key={v.id} value={v.id}>{lang === "ar" && v.nameAr ? v.nameAr : v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button
          type="button"
          onClick={() => update({ compare: !filters.compare })}
          aria-pressed={filters.compare}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
            filters.compare ? "border-primary bg-primary/10 text-primary" : "border-border text-[hsl(var(--ink-2))] hover:bg-muted/50",
          )}
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          {t("report_compare")}
        </button>
        <span className="ms-auto text-xs text-[hsl(var(--ink-3))]">
          {rangeLabel(filters.from, filters.to, lang)}
          {filters.compare && <> · {t("report_vs")} {rangeLabel(prev.from, prev.to, lang)}</>}
        </span>
      </div>
    </div>
  )
}
