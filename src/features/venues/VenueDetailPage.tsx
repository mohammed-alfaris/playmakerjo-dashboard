import { useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Coins, CalendarCheck, Star, Percent } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs } from "@/components/shared/design/Tabs"
import { VenueFormDialog } from "./VenueFormDialog"
import { VenueSlotTimeline } from "./VenueSlotTimeline"
import { PermanentBookingsTab } from "./PermanentBookingsTab"
import { VenueHero } from "./VenueHero"
import { KpiCard } from "./KpiCard"
import {
  OverviewTab,
  PitchesTab,
  HoursTab,
  GalleryTab,
  Lightbox,
  PaymentsTab,
  ReviewsTab,
} from "./tabs"
import { useAuthStore } from "@/store/authStore"
import { getVenue, getVenueStats, type Pitch, type Venue } from "@/api/venues"
import { getPayments, type Payment } from "@/api/payments"
import { getReviews, type Review } from "@/api/reviews"
import { usePagination } from "@/hooks/usePagination"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { utilizationFor } from "@/lib/timelineDesign"
import { getBookings, type Booking } from "@/api/bookings"

// ---------------------------------------------------------------------------
// V1 Venue Profile — hero + 4-card KPI + 7-tab shell.
// Tab content is split into individual components under ./tabs/.
// ---------------------------------------------------------------------------

type TabId =
  | "overview"
  | "pitches"
  | "hours"
  | "gallery"
  | "payments"
  | "reviews"
  | "permanent"

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useT()
  const [editOpen, setEditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [coverIdx, setCoverIdx] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // ---- Data fetching ----

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

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["venue-reviews", id],
    queryFn: () => getReviews({ venueId: id, page: 1, limit: 20 }),
    enabled: !!id,
  })
  const reviews: Review[] = useMemo(() => reviewsData?.data ?? [], [reviewsData])
  const reviewsTotal: number = reviewsData?.pagination?.total ?? reviews.length
  const avgRating = useMemo(() => {
    if (stats?.avgRating != null) return stats.avgRating
    if (reviews.length === 0) return 0
    return reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length
  }, [reviews, stats])

  const { page: payPage, limit: payLimit, setPage: setPayPage } = usePagination(10)
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ["venue-payments", id, payPage],
    queryFn: () => getPayments({ venueId: id, page: payPage, limit: payLimit }),
    enabled: !!id && activeTab === "payments",
  })
  const payments: Payment[] = paymentsData?.data ?? []
  const paymentsPagination = paymentsData?.pagination ?? {
    page: payPage,
    limit: payLimit,
    total: 0,
  }

  // ---- Derived values ----

  const images = venue?.images ?? []
  const pitches: Pitch[] = venue?.pitches ?? []

  const currentUser = useAuthStore((s) => s.user)
  const canManagePermanent =
    currentUser?.role === "super_admin" ||
    (currentUser?.role === "venue_owner" && venue?.owner?.id === currentUser.id)

  const tabs: Array<{ id: TabId; label: string; badge?: string | number }> = [
    { id: "overview", label: t("tab_overview") },
    { id: "pitches", label: t("tab_pitches"), badge: pitches.length || undefined },
    { id: "hours", label: t("tab_hours") },
    { id: "gallery", label: t("tab_gallery"), badge: images.length || undefined },
    { id: "payments", label: t("tab_payments") },
    { id: "reviews", label: t("tab_reviews"), badge: reviewsTotal || undefined },
    ...(canManagePermanent
      ? [{ id: "permanent" as TabId, label: t("tab_permanent") }]
      : []),
  ]

  // ---- Render ----

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
        <ChevronRight className="h-3 w-3 rtl:rotate-180" />
        <span className="text-[hsl(var(--ink))] font-medium truncate max-w-[40ch]">
          {venue.name}
        </span>
      </nav>

      {/* Hero */}
      <VenueHero
        venue={venue}
        images={images}
        coverIdx={coverIdx}
        onCoverChange={setCoverIdx}
        avgRating={avgRating}
        reviewsTotal={reviewsTotal}
        onEdit={() => setEditOpen(true)}
        onShowAllImages={() => setActiveTab("gallery")}
      />

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
          tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label, badge: tab.badge }))}
          active={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {activeTab === "overview" && <OverviewTab venue={venue} />}
        {activeTab === "pitches" && <PitchesTab pitches={pitches} onEdit={() => setEditOpen(true)} />}
        {activeTab === "hours" && <HoursTab venue={venue} />}
        {activeTab === "gallery" && <GalleryTab images={images} onOpen={setLightboxIdx} />}
        {activeTab === "payments" && (
          <PaymentsTab
            payments={payments}
            isLoading={paymentsLoading}
            pagination={paymentsPagination}
            onPageChange={setPayPage}
          />
        )}
        {activeTab === "reviews" && <ReviewsTab reviews={reviews} isLoading={reviewsLoading} />}
        {activeTab === "permanent" && canManagePermanent && <PermanentBookingsTab venue={venue} />}
      </div>

      {/* Embedded live timeline */}
      {activeTab === "overview" && venue.id && <VenueSlotTimeline venue={venue} />}

      {/* Edit dialog */}
      <VenueFormDialog open={editOpen} onOpenChange={setEditOpen} venue={venue} />

      {/* Gallery lightbox */}
      {lightboxIdx != null && images[lightboxIdx] && (
        <Lightbox
          src={images[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onPrev={lightboxIdx > 0 ? () => setLightboxIdx(lightboxIdx - 1) : undefined}
          onNext={lightboxIdx < images.length - 1 ? () => setLightboxIdx(lightboxIdx + 1) : undefined}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton + helpers
// ---------------------------------------------------------------------------

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
