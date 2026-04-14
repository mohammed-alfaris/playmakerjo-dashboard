import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Pencil, CalendarCheck, DollarSign, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataTable } from "@/components/shared/DataTable"
import { VenueFormDialog } from "./VenueFormDialog"
import { getVenue, getVenueStats } from "@/api/venues"
import { getBookings, type Booking } from "@/api/bookings"
import { usePagination } from "@/hooks/usePagination"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editOpen, setEditOpen]       = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const { page, limit, setPage } = usePagination(10)
  const { t } = useT()

  const { data: venueData, isLoading: venueLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => getVenue(id!),
    enabled: !!id,
  })
  const venue = venueData?.data

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["venue-stats", id],
    queryFn: () => getVenueStats(id!),
    enabled: !!id,
  })
  const stats = statsData?.data

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["venue-bookings", id, page],
    queryFn: () => getBookings({ venue_id: id, page, limit }),
    enabled: !!id,
  })
  const bookings: Booking[] = bookingsData?.data ?? []
  const bookingsPagination = bookingsData?.pagination ?? { page, limit, total: 0 }

  const bookingColumns: ColumnDef<Booking>[] = [
    {
      accessorKey: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDateTime(row.original.date)}</span>
      ),
    },
    {
      accessorKey: "player",
      header: t("player"),
      cell: ({ row }) => row.original.player.name,
    },
    {
      accessorKey: "sport",
      header: t("sport"),
      cell: ({ row }) => <span className="capitalize">{row.original.sport}</span>,
    },
    {
      accessorKey: "duration",
      header: t("duration"),
      cell: ({ row }) => `${row.original.duration}h`,
    },
    {
      accessorKey: "amount",
      header: t("amount"),
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  const images = venue?.images ?? []

  return (
    <div className="space-y-6">

      {/* Image gallery */}
      {!venueLoading && images.length > 0 && (
        <div className="relative w-full h-56 sm:h-72 rounded-xl overflow-hidden bg-muted">
          <img
            key={activeImage}
            src={images[activeImage]}
            alt={venue?.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {images.length > 1 && (
            <>
              <button
                onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`h-1.5 rounded-full transition-all ${i === activeImage ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {venueLoading && (
        <Skeleton className="w-full h-56 sm:h-72 rounded-xl" />
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/venues")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {venueLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <PageHeader
              title={venue?.name ?? "Venue"}
              subtitle={`${venue?.city ?? ""} • ${venue?.address ?? ""}`}
              action={
                <div className="flex items-center gap-2">
                  {venue && <StatusBadge status={venue.status} />}
                  {venue?.latitude && venue?.longitude && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        {t("view_on_map")}
                      </a>
                    </Button>
                  )}
                  <Button onClick={() => setEditOpen(true)} variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("edit")}
                  </Button>
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* Sports badges */}
      {!venueLoading && venue?.sports && (
        <div className="flex flex-wrap gap-2 -mt-4">
          {venue.sports.map((s: string) => (
            <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={t("total_bookings_venue")}
          value={stats?.totalBookings ?? "—"}
          icon={CalendarCheck}
          color="blue"
          isLoading={statsLoading}
        />
        <StatCard
          title={t("total_revenue_venue")}
          value={stats ? formatCurrency(stats.totalRevenue) : "—"}
          icon={DollarSign}
          color="green"
          isLoading={statsLoading}
        />
        <StatCard
          title={t("active_since")}
          value={stats?.activeSince ? formatDate(stats.activeSince) : "—"}
          icon={Clock}
          color="purple"
          isLoading={statsLoading}
        />
      </div>

      {/* Venue Info Card */}
      {!venueLoading && (venue?.description || (venue?.latitude && venue?.longitude)) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {venue?.description && (
              <p className="text-sm text-muted-foreground">{venue.description}</p>
            )}
            {venue?.latitude && venue?.longitude && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {venue.latitude.toFixed(6)}, {venue.longitude.toFixed(6)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bookings Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("bookings")}</h2>
        <DataTable
          columns={bookingColumns}
          data={bookings}
          pagination={bookingsPagination}
          onPageChange={setPage}
          isLoading={bookingsLoading}
          emptyMessage={t("no_bookings_venue")}
        />
      </div>

      {/* Edit Dialog */}
      {venue && (
        <VenueFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          venue={venue}
        />
      )}
    </div>
  )
}
