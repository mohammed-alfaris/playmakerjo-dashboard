import { ExternalLink } from "lucide-react"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import type { Venue } from "@/api/venues"

// ---------------------------------------------------------------------------
// Overview tab — venue info cards (about, contact, location)
// ---------------------------------------------------------------------------

export function OverviewTab({ venue }: { venue: Venue }) {
  const { t } = useT()
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Section title={t("profile_about")}>
        {venue.description ? (
          <p className="text-[13px] text-[hsl(var(--ink-2))] leading-relaxed">
            {venue.description}
          </p>
        ) : (
          <p className="text-[12.5px] italic text-[hsl(var(--ink-3))]">—</p>
        )}
      </Section>
      <Section title={t("profile_contact")}>
        <dl className="grid gap-2 text-[12.5px]">
          <KV k={t("owner")} v={venue.owner?.name ?? "—"} />
          {venue.cliqAlias && <KV k="CliQ" v={venue.cliqAlias} />}
          <KV k={t("price_per_hour")} v={formatCurrency(venue.pricePerHour)} />
        </dl>
      </Section>
      <Section title={t("profile_location")}>
        <div className="space-y-2">
          <p className="text-[12.5px] text-[hsl(var(--ink-2))]">
            {venue.city}
            {venue.address ? ` · ${venue.address}` : ""}
          </p>
          {venue.latitude != null && venue.longitude != null && (
            <a
              href={`https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[11px] text-[hsl(var(--brand))] hover:underline inline-flex items-center gap-1"
            >
              {venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared helpers (Section + KV) — kept here as they are only used by Overview
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] shadow-sm-stadium p-4 space-y-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
        {title}
      </div>
      {children}
    </div>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[11px] text-[hsl(var(--ink-3))]">{k}</dt>
      <dd className="font-medium text-[hsl(var(--ink))] truncate max-w-[60%]">{v}</dd>
    </div>
  )
}
