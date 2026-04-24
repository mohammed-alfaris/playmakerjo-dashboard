import { useMemo, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import {
  ChevronRight,
  Pencil,
  MapPin,
  CalendarCheck,
  Coins,
  Star,
  Percent,
  ChevronLeft,
  ExternalLink,
  Image as ImageIcon,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataTable } from "@/components/shared/DataTable"
import { Chip } from "@/components/shared/design/Chip"
import { Tabs } from "@/components/shared/design/Tabs"
import { VenueFormDialog } from "./VenueFormDialog"
import { VenueSlotTimeline } from "./VenueSlotTimeline"
import { getVenue, getVenueStats, type Pitch, type Venue } from "@/api/venues"
import { getPayments, type Payment } from "@/api/payments"
import { getReviews, type Review } from "@/api/reviews"
import { usePagination } from "@/hooks/usePagination"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"
import type { DayHours, DayOfWeek } from "@/lib/types"
import { utilizationFor } from "@/lib/timelineDesign"
import { getBookings, type Booking } from "@/api/bookings"

// ---------------------------------------------------------------------------
// V1 Venue Profile — hero + 4-card KPI + 6-tab shell.
// Every tab wired to real API data (bookings / payments / reviews). Falls back
// gracefully when the backend hasn't been extended with daily aggregates yet.
// ---------------------------------------------------------------------------

type TabId = "overview" | "pitches" | "hours" | "gallery" | "payments" | "reviews"

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const [editOpen, setEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [coverIdx, setCoverIdx] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const { data: venueData, isLoading: venueLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => getVenue(id!),
    enabled: !!id,
  })
  const venue: Venue | undefined = venueData?.data

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["venue-stats", id],
    queryFn: () => getVenueStats(id!),
    enabled: !!id,
  })
  const stats = statsData?.data as
    | {
        totalBookings: number
        totalRevenue: number
        activeSince: string
        dailyBookings?: number[]
        dailyRevenue?: number[]
        avgRating?: number
        totalReviews?: number
      }
    | undefined

  // Today's bookings — used to compute live utilization for the KPI row
  const todayIso = toISODate(new Date())
  const { data: todayBookingsData } = useQuery({
    queryKey: ["venue-today-bookings", id, todayIso],
    queryFn: () =>
      getBookings({ venue_id: id, from: todayIso, to: todayIso, page: 1, limit: 100 }),
    enabled: !!id,
  })
  const todayBookings: Booking[] = useMemo(
    () => todayBookingsData?.data ?? [],
    [todayBookingsData],
  )

  const utilization = useMemo(() => {
    if (!venue) return 0
    return Math.round(utilizationFor(venue, todayBookings, new Date()) * 100)
  }, [venue, todayBookings])

  // Reviews — tab + average rating
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["venue-reviews", id],
    queryFn: () => getReviews({ venueId: id, page: 1, limit: 20 }),
    enabled: !!id,
  })
  const reviews: Review[] = useMemo(
    () => reviewsData?.data ?? [],
    [reviewsData],
  )
  const reviewsTotal: number = reviewsData?.pagination?.total ?? reviews.length
  const avgRating = useMemo(() => {
    if (stats?.avgRating != null) return stats.avgRating
    if (reviews.length === 0) return 0
    return reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
  }, [reviews, stats])

  // Payments — scoped to this venue
  const { page: payPage, limit: payLimit, setPage: setPayPage } = usePagination(10)
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ["venue-payments", id, payPage],
    queryFn: () =>
      getPayments({ venueId: id, page: payPage, limit: payLimit }),
    enabled: !!id && activeTab === "payments",
  })
  const payments: Payment[] = paymentsData?.data ?? []
  const paymentsPagination = paymentsData?.pagination ?? {
    page: payPage,
    limit: payLimit,
    total: 0,
  }

  const images = venue?.images ?? []
  const primaryImage = images[coverIdx] ?? images[0]

  const sportsChips = venue?.sports ?? []
  const pitches: Pitch[] = venue?.pitches ?? []

  const tabs: Array<{ id: TabId; label: string; badge?: string | number }> = [
    { id: "overview", label: t("tab_overview") },
    { id: "pitches", label: t("tab_pitches"), badge: pitches.length || undefined },
    { id: "hours", label: t("tab_hours") },
    { id: "gallery", label: t("tab_gallery"), badge: images.length || undefined },
    { id: "payments", label: t("tab_payments") },
    { id: "reviews", label: t("tab_reviews"), badge: reviewsTotal || undefined },
  ]

  if (venueLoading || !venue) {
    return <ProfileSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--ink-3))]">
        <Link to="/venues" className="hover:text-[hsl(var(--ink))]">
          {t("venues")}
        </Link>
        <ChevronRight className="h-3 w-3 rtl-flip" />
        <span className="text-[hsl(var(--ink))] font-medium truncate max-w-[40ch]">
          {venue.name}
        </span>
      </nav>

      {/* Hero */}
      <div
        className="grid gap-5 rounded-[20px] bg-card border border-[hsl(var(--line))] shadow-md-stadium overflow-hidden"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.8fr)" }}
      >
        {/* Left: identity */}
        <div className="p-6 md:p-8 flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={venue.status} />
            {sportsChips.slice(0, 4).map((s) => (
              <Chip key={s} color="brand" size="sm">
                <span className="capitalize">{s}</span>
              </Chip>
            ))}
            {sportsChips.length > 4 && (
              <Chip color="slate" size="sm">
                +{sportsChips.length - 4}
              </Chip>
            )}
            {reviewsTotal > 0 && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-[hsl(var(--ink-2))]">
                <Star className="h-3 w-3 text-[hsl(var(--amber))]" fill="currentColor" />
                <span className="font-semibold">{avgRating.toFixed(1)}</span>
                <span className="text-[hsl(var(--ink-3))]">· {reviewsTotal}</span>
              </span>
            )}
          </div>
          <h1 className="display text-[30px] md:text-[36px] font-semibold tracking-[-0.02em] text-[hsl(var(--ink))] leading-[1.05]">
            {venue.name}
          </h1>
          <div className="flex items-start gap-1.5 text-[13px] text-[hsl(var(--ink-2))]">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--ink-3))]" />
            <span className="min-w-0">
              {venue.city}
              {venue.address ? ` · ${venue.address}` : ""}
            </span>
          </div>
          {venue.description && (
            <p className="text-[13px] text-[hsl(var(--ink-2))] leading-relaxed max-w-[60ch]">
              {venue.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              {t("profile_edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => navigate(`/timeline?venue=${venue.id}`)}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              {t("profile_view_timeslots")}
            </Button>
            {venue.latitude != null && venue.longitude != null && (
              <Button size="sm" variant="ghost" asChild className="gap-1.5">
                <a
                  href={`https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {t("profile_open_in_maps")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Right: cover + thumbnails */}
        <div className="relative bg-[hsl(var(--surface-2))] min-h-[240px]">
          {primaryImage ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(90deg, hsl(var(--card)) 0%, transparent 30%), url(${primaryImage})`,
              }}
              role="img"
              aria-label={venue.name}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--ink-3))]">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
          {images.length > 1 && (
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              {images.slice(0, 3).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCoverIdx(i)}
                  className={cn(
                    "h-11 w-11 rounded-md bg-cover bg-center border-2 transition-colors",
                    i === coverIdx
                      ? "border-[hsl(var(--brand))]"
                      : "border-white/60 hover:border-white",
                  )}
                  style={{ backgroundImage: `url(${src})` }}
                  aria-label={`Cover ${i + 1}`}
                />
              ))}
              {images.length > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("gallery")
                  }}
                  className="h-11 w-11 rounded-md bg-black/70 text-white text-[11px] font-semibold flex items-center justify-center"
                >
                  +{images.length - 3}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label={t("profile_revenue_30d")}
          value={stats ? formatCurrency(stats.totalRevenue) : "—"}
          icon={<Coins className="h-3.5 w-3.5" />}
          tone="brand"
          series={stats?.dailyRevenue}
          isLoading={statsLoading}
        />
        <KpiCard
          label={t("profile_bookings_30d")}
          value={stats ? String(stats.totalBookings) : "—"}
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          tone="indigo"
          series={stats?.dailyBookings}
          isLoading={statsLoading}
        />
        <KpiCard
          label={t("utilization")}
          value={`${utilization}%`}
          icon={<Percent className="h-3.5 w-3.5" />}
          tone="sky"
          isLoading={statsLoading}
        />
        <KpiCard
          label={t("profile_avg_rating")}
          value={avgRating > 0 ? avgRating.toFixed(1) : "—"}
          sublabel={reviewsTotal > 0 ? `${reviewsTotal} ${lang === "ar" ? "تقييم" : "reviews"}` : undefined}
          icon={<Star className="h-3.5 w-3.5" />}
          tone="amber"
          isLoading={reviewsLoading}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto">
        <Tabs
          tabs={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            badge: tab.badge,
          }))}
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === "overview" && (
          <OverviewTab venue={venue} />
        )}

        {activeTab === "pitches" && (
          <PitchesTab pitches={pitches} onEdit={() => setEditOpen(true)} />
        )}

        {activeTab === "hours" && (
          <HoursTab venue={venue} />
        )}

        {activeTab === "gallery" && (
          <GalleryTab images={images} onOpen={setLightboxIdx} />
        )}

        {activeTab === "payments" && (
          <PaymentsTab
            payments={payments}
            isLoading={paymentsLoading}
            pagination={paymentsPagination}
            onPageChange={setPayPage}
          />
        )}

        {activeTab === "reviews" && (
          <ReviewsTab reviews={reviews} isLoading={reviewsLoading} />
        )}
      </div>

      {/* Embedded live timeline */}
      {activeTab === "overview" && venue.id && <VenueSlotTimeline venue={venue} />}

      {/* Edit dialog */}
      {venue && (
        <VenueFormDialog open={editOpen} onOpenChange={setEditOpen} venue={venue} />
      )}

      {/* Gallery lightbox */}
      {lightboxIdx != null && images[lightboxIdx] && (
        <Lightbox
          src={images[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onPrev={
            lightboxIdx > 0 ? () => setLightboxIdx(lightboxIdx - 1) : undefined
          }
          onNext={
            lightboxIdx < images.length - 1
              ? () => setLightboxIdx(lightboxIdx + 1)
              : undefined
          }
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KpiCard — 4-card row, optional sparkline
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  tone,
  series,
  isLoading,
}: {
  label: string
  value: string
  sublabel?: string
  icon?: React.ReactNode
  tone: "brand" | "amber" | "sky" | "indigo"
  series?: number[]
  isLoading?: boolean
}) {
  const toneCls = {
    brand: "bg-[hsl(var(--brand-tint))] text-[hsl(var(--brand-ink))]",
    amber: "bg-[hsl(var(--amber-tint))] text-[hsl(var(--amber-ink))]",
    sky: "bg-[hsl(var(--sky-tint))] text-[hsl(var(--sky-ink))]",
    indigo: "bg-[hsl(var(--indigo-tint))] text-[hsl(var(--indigo-ink))]",
  }[tone]
  return (
    <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] shadow-sm-stadium p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
          {label}
        </div>
        {icon && (
          <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md", toneCls)}>
            {icon}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <>
          <div className="display text-[24px] font-semibold leading-none text-[hsl(var(--ink))] tracking-[-0.01em]">
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] text-[hsl(var(--ink-3))]">{sublabel}</div>
          )}
        </>
      )}
      <Sparkline data={series} tone={tone} />
    </div>
  )
}

function Sparkline({
  data,
  tone,
}: {
  data?: number[]
  tone: "brand" | "amber" | "sky" | "indigo"
}) {
  const toneBg = {
    brand: "bg-[hsl(var(--brand))]",
    amber: "bg-[hsl(var(--amber))]",
    sky: "bg-[hsl(var(--sky))]",
    indigo: "bg-[hsl(var(--indigo))]",
  }[tone]
  const points = data && data.length > 0 ? data : new Array(12).fill(0)
  const max = Math.max(1, ...points)
  return (
    <div className="flex items-end gap-[2px] h-6">
      {points.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-[2px] opacity-70", toneBg)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function OverviewTab({ venue }: { venue: Venue }) {
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
// Pitches tab
// ---------------------------------------------------------------------------

function PitchesTab({ pitches, onEdit }: { pitches: Pitch[]; onEdit: () => void }) {
  const { t } = useT()
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
                  {[p.parentSize, ...p.subSizes].filter(Boolean).join(" / ")}-aside
                </div>
              )}
            </div>
            <Chip color="brand" size="sm">
              <span className="capitalize">{p.sport}</span>
            </Chip>
            <span className="mono text-[12px] text-[hsl(var(--ink-2))]">
              {p.parentSize ? `${p.parentSize}-aside` : "—"}
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

// ---------------------------------------------------------------------------
// Hours tab
// ---------------------------------------------------------------------------

const DAY_ORDER: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function HoursTab({ venue }: { venue: Venue }) {
  const { t } = useT()
  const oh = venue.operatingHours ?? {}
  const todayIdx = (new Date().getDay() + 6) % 7 // Sunday = 6 => Sunday at end
  return (
    <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] overflow-hidden">
      <ul>
        {DAY_ORDER.map((day, i) => {
          const dh: DayHours | undefined = oh[day]
          const isToday = i === todayIdx
          const closed = !dh || dh.closed || !dh.open || !dh.close
          return (
            <li
              key={day}
              className={cn(
                "flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--line))] last:border-b-0 text-[13px]",
                isToday && "bg-[hsl(var(--brand-tint))]",
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  isToday ? "text-[hsl(var(--brand-ink))]" : "text-[hsl(var(--ink))]",
                )}
              >
                {t(day)}
                {isToday && (
                  <span className="ms-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
                    {t("today")}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "mono",
                  closed
                    ? "text-[hsl(var(--rose-ink))]"
                    : isToday
                      ? "text-[hsl(var(--brand-ink))]"
                      : "text-[hsl(var(--ink-2))]",
                )}
              >
                {closed ? t("closed") : `${dh!.open} – ${dh!.close}`}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gallery tab + lightbox
// ---------------------------------------------------------------------------

function GalleryTab({
  images,
  onOpen,
}: {
  images: string[]
  onOpen: (i: number) => void
}) {
  const { t } = useT()
  if (images.length === 0) {
    return (
      <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] p-8 text-center text-sm text-[hsl(var(--ink-3))]">
        {t("profile_no_gallery")}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {images.map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="aspect-[4/3] rounded-[12px] overflow-hidden bg-[hsl(var(--surface-2))] group relative"
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </button>
      ))}
    </div>
  )
}

function Lightbox({
  src,
  onClose,
  onPrev,
  onNext,
}: {
  src: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {onPrev && (
        <button
          type="button"
          className="absolute left-5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          className="absolute right-5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full rounded-lg shadow-lg-stadium"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Payments tab
// ---------------------------------------------------------------------------

function PaymentsTab({
  payments,
  isLoading,
  pagination,
  onPageChange,
}: {
  payments: Payment[]
  isLoading: boolean
  pagination: { page: number; limit: number; total: number }
  onPageChange: (p: number) => void
}) {
  const { t } = useT()
  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-[hsl(var(--ink-2))]">
          {formatDateTime(row.original.date)}
        </span>
      ),
    },
    {
      accessorKey: "bookingRef",
      header: t("profile_booking_col"),
      cell: ({ row }) => (
        <span className="mono text-[11px] text-[hsl(var(--ink-3))]">
          {row.original.bookingRef}
        </span>
      ),
    },
    {
      accessorKey: "player",
      header: t("player"),
      cell: ({ row }) => row.original.player.name,
    },
    {
      accessorKey: "amount",
      header: t("amount"),
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "method",
      header: t("payment_method"),
      cell: ({ row }) => (
        <span className="mono text-[11px] uppercase text-[hsl(var(--ink-2))]">
          {row.original.method}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
  return (
    <DataTable
      columns={columns}
      data={payments}
      pagination={pagination}
      onPageChange={onPageChange}
      isLoading={isLoading}
      emptyMessage={t("profile_no_payments")}
    />
  )
}

// ---------------------------------------------------------------------------
// Reviews tab
// ---------------------------------------------------------------------------

function ReviewsTab({ reviews, isLoading }: { reviews: Review[]; isLoading: boolean }) {
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

// ---------------------------------------------------------------------------
// Reusable helpers
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

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-[260px] w-full rounded-[20px]" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="h-10 w-80 rounded-[12px]" />
      <Skeleton className="h-[220px] w-full rounded-[14px]" />
    </div>
  )
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
