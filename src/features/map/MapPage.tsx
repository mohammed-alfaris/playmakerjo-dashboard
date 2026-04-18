import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin, Search, ExternalLink, Navigation, Circle } from "lucide-react"
import { getVenues, type Venue } from "@/api/venues"
import { useT } from "@/i18n/LanguageContext"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

// Jordan (Amman) — default view
const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106]
const DEFAULT_ZOOM = 8

type StatusKey = "active" | "inactive" | "pending"

const STATUS_COLOR: Record<StatusKey, { ring: string; dot: string; hsl: string }> = {
  active:   { ring: "ring-brand/50",   dot: "bg-brand",   hsl: "hsl(var(--brand))"   },
  pending:  { ring: "ring-amber/50",   dot: "bg-amber",   hsl: "hsl(var(--amber))"   },
  inactive: { ring: "ring-rose/50",    dot: "bg-rose",    hsl: "hsl(var(--rose))"    },
}

// Build a colored SVG pin (no external PNGs, matches design tokens)
function pinIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <defs>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <path filter="url(#s)" d="M16 1.5C8.5 1.5 2.5 7.4 2.5 14.8c0 10.8 13.5 23.2 13.5 23.2s13.5-12.4 13.5-23.2C29.5 7.4 23.5 1.5 16 1.5z"
        fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="15" r="5.2" fill="white"/>
    </svg>
  `.trim()
  return L.divIcon({
    className: "pm-map-pin",
    html: svg,
    iconSize: [32, 40],
    iconAnchor: [16, 38],
    popupAnchor: [0, -34],
  })
}

/** Invalidate Leaflet size after the container mounts (fixes grey tiles on first paint). */
function InvalidateSize({ ready }: { ready: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => map.invalidateSize(), 80)
    return () => clearTimeout(t)
  }, [map, ready])
  return null
}

/** Imperative helper exposed via a ref so the sidebar list can fly the map. */
function MapRefBinder({ bind }: { bind: (m: L.Map) => void }) {
  const map = useMap()
  useEffect(() => { bind(map) }, [bind, map])
  return null
}

export default function MapPage() {
  const { t } = useT()
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["map-venues"],
    queryFn: () => getVenues({ page: 1, limit: 500 }),
  })
  const allVenues: Venue[] = useMemo(() => data?.data ?? [], [data])

  // Only venues with GPS can plot on map
  const geoVenues = useMemo(
    () => allVenues.filter((v) => typeof v.latitude === "number" && typeof v.longitude === "number"),
    [allVenues]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return geoVenues.filter((v) => {
      const matchQ =
        !q ||
        v.name.toLowerCase().includes(q) ||
        (v.city ?? "").toLowerCase().includes(q) ||
        (v.address ?? "").toLowerCase().includes(q)
      const matchS = statusFilter === "all" || v.status === statusFilter
      return matchQ && matchS
    })
  }, [geoVenues, search, statusFilter])

  // KPI counts
  const counts = useMemo(() => {
    const c = { total: geoVenues.length, active: 0, pending: 0, inactive: 0, missing: allVenues.length - geoVenues.length }
    for (const v of geoVenues) {
      if (v.status === "active") c.active++
      else if (v.status === "pending") c.pending++
      else if (v.status === "inactive") c.inactive++
    }
    return c
  }, [geoVenues, allVenues.length])

  const flyTo = (v: Venue) => {
    if (!mapRef.current || v.latitude == null || v.longitude == null) return
    mapRef.current.flyTo([v.latitude, v.longitude], 15, { duration: 0.9 })
    setSelectedId(v.id)
  }

  const resetView = () => {
    mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 })
    setSelectedId(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            {t("nav_map") ?? "Map"}
          </div>
          <h1 className="display m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {t("map_title") ?? "Pitches map"}
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            {t("map_subtitle") ?? "All venues with GPS coordinates, shown across Jordan."}
          </p>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-card px-3.5 py-2 text-sm text-ink-2 shadow-stadium-sm transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Navigation className="h-3.5 w-3.5" />
          {t("reset_view") ?? "Reset view"}
        </button>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <MapKpi label={t("on_map") ?? "On map"}       value={counts.total}     accent="brand"  />
        <MapKpi label={t("status_active")}            value={counts.active}    accent="brand"  />
        <MapKpi label={t("status_pending")}           value={counts.pending}   accent="amber"  />
        <MapKpi label={t("no_coordinates") ?? "No coords"} value={counts.missing} accent="ghost" />
      </div>

      {/* Main 2-column layout */}
      <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
        {/* Sidebar list */}
        <aside className="flex min-h-0 flex-col gap-3 rounded-2xl bg-card p-4 shadow-stadium-sm">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_venues") ?? "Search venues..."}
              className="w-full rounded-xl border border-line-strong bg-surface-2 px-9 py-2 text-sm text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-primary"
            />
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {(["all", "active", "pending", "inactive"] as const).map((s) => {
              const active = statusFilter === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line-strong bg-surface-2 text-ink-3 hover:text-ink"
                  )}
                >
                  {s === "all" ? (t("all") ?? "All") : t(`status_${s}` as "status_active" | "status_pending" | "status_inactive")}
                </button>
              )
            })}
          </div>

          {/* Counter */}
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
            <span>{t("results") ?? "Results"}</span>
            <span>{filtered.length}</span>
          </div>

          {/* List */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pe-1">
            {isLoading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
                ))}
              </>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 p-6 text-center">
                <MapPin className="h-5 w-5 text-ink-3" />
                <p className="text-sm text-ink-2">{t("no_venues_on_map") ?? "No venues match your filters."}</p>
              </div>
            )}

            {!isLoading &&
              filtered.map((v) => {
                const status = (v.status as StatusKey) ?? "inactive"
                const clr = STATUS_COLOR[status] ?? STATUS_COLOR.inactive
                const isSel = selectedId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => flyTo(v)}
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-xl border bg-surface-2 p-3 text-start transition-all",
                      isSel
                        ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                        : "border-line-strong hover:bg-surface-3 hover:border-line-strong"
                    )}
                  >
                    <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2", clr.dot, clr.ring)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{v.name}</p>
                      </div>
                      <p className="truncate text-[11px] text-ink-3">
                        {v.city ?? "—"}{v.address ? ` · ${v.address}` : ""}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusBadge status={v.status} />
                        <span className="text-[11px] text-ink-3">
                          {formatCurrency(v.pricePerHour)}/{t("hour_short")}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>

          {/* Legend */}
          <div className="shrink-0 border-t border-line-strong pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              {t("legend") ?? "Legend"}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <LegendDot className="bg-brand" label={t("status_active")} />
              <LegendDot className="bg-amber" label={t("status_pending")} />
              <LegendDot className="bg-rose"  label={t("status_inactive")} />
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="relative h-[72vh] min-h-[520px] overflow-hidden rounded-2xl bg-card shadow-stadium-sm">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            className="h-full w-full"
            style={{ background: "hsl(var(--surface-2))" }}
          >
            <MapRefBinder bind={(m) => (mapRef.current = m)} />
            <InvalidateSize ready={!isLoading} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map((v) => {
              const status = (v.status as StatusKey) ?? "inactive"
              const color = STATUS_COLOR[status]?.hsl ?? STATUS_COLOR.inactive.hsl
              return (
                <Marker
                  key={v.id}
                  position={[v.latitude!, v.longitude!]}
                  icon={pinIcon(color)}
                  eventHandlers={{
                    click: () => setSelectedId(v.id),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px] space-y-1.5">
                      <p className="m-0 text-sm font-semibold text-ink">{v.name}</p>
                      <p className="m-0 text-[11px] text-ink-3">
                        {v.city ?? "—"}{v.address ? ` · ${v.address}` : ""}
                      </p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={v.status} />
                        <span className="text-[11px] text-ink-3">
                          {formatCurrency(v.pricePerHour)}/{t("hour_short")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/venues/${v.id}`)}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("view") ?? "View"}
                        </button>
                        <a
                          href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-2"
                        >
                          <Navigation className="h-3 w-3" />
                          {t("directions") ?? "Directions"}
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>

          {isLoading && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-surface-2/40">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────

function MapKpi({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent: "brand" | "amber" | "rose" | "ghost"
}) {
  const accentMap: Record<string, string> = {
    brand: "text-brand",
    amber: "text-amber-ink",
    rose:  "text-rose-ink",
    ghost: "text-ink-3",
  }
  return (
    <div className="rounded-2xl bg-card p-4 shadow-stadium-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        <Circle className={cn("h-2 w-2 fill-current", accentMap[accent])} strokeWidth={0} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {label}
    </div>
  )
}
