import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { Plus, Pencil, Trash2, Search, MapPin as MapPinIcon, X, CheckCircle, XCircle, Power, PowerOff } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { VenueFormDialog } from "./VenueFormDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getVenues, deleteVenue, updateVenueStatus, type Venue } from "@/api/venues"
import { usePagination } from "@/hooks/usePagination"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { SPORTS, VENUE_STATUSES } from "@/lib/constants"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

function VenueThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <div className="h-9 w-14 rounded-md bg-muted shrink-0" />
  }
  return (
    <img
      src={src}
      alt={alt}
      className="h-9 w-14 rounded-md object-cover shrink-0 bg-muted"
      onError={() => setFailed(true)}
    />
  )
}

export default function VenuesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { page, limit, setPage, resetPage } = usePagination()
  const { isAdmin } = useRole()
  const ownerFilter = useOwnerFilter()
  const { t, lang } = useT()

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [sport, setSport] = useState("all")
  const [status, setStatus] = useState("all")

  const [formOpen, setFormOpen] = useState(false)
  const [editVenue, setEditVenue] = useState<Venue | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Venue | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      resetPage()
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, resetPage])

  const handleFilterChange = useCallback((setter: (v: string) => void) => (v: string) => {
    setter(v)
    resetPage()
  }, [resetPage])

  const { data, isLoading } = useQuery({
    queryKey: ["venues", { page, limit, search, sport: sport === "all" ? "" : sport, status: status === "all" ? "" : status, ...ownerFilter }],
    queryFn: () => getVenues({
      page, limit, search,
      sport:  sport  === "all" ? undefined : sport,
      status: status === "all" ? undefined : status,
      ...ownerFilter,
    }),
  })

  const venues: Venue[] = data?.data ?? []
  const pagination = data?.pagination ?? { page, limit, total: 0 }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: () => {
      toast.success(t("venue_deleted"))
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      setDeleteTarget(null)
    },
    onError: () => toast.error(t("venue_delete_failed")),
  })

  const approvalMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      updateVenueStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "active" ? t("venue_approved") : t("venue_rejected"))
      queryClient.invalidateQueries({ queryKey: ["venues"] })
    },
    onError: () => toast.error(t("venue_approval_failed")),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      updateVenueStatus(id, status),
    onSuccess: (_, vars) => {
      toast.success(vars.status === "active" ? t("venue_reactivated") : t("venue_deactivated"))
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      setToggleTarget(null)
    },
    onError: () => toast.error(t("venue_status_update_failed")),
  })

  const columns: ColumnDef<Venue>[] = [
    {
      accessorKey: "name",
      header: t("name"),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-3">
            <VenueThumbnail src={row.original.images?.[0]} alt={row.original.name} />
            <Link
              to={`/venues/${row.original.id}`}
              className="font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.name}
            </Link>
          </div>
        )
      },
    },
    ...(isAdmin ? [{
      accessorKey: "owner",
      header: t("owner"),
      cell: ({ row }: { row: { original: Venue } }) => row.original.owner.name,
    } satisfies ColumnDef<Venue>] : []),
    {
      accessorKey: "sports",
      header: t("sports"),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.sports.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs capitalize">
              {s}
            </Badge>
          ))}
        </div>
      ),
    },
    { accessorKey: "city", header: t("city") },
    {
      accessorKey: "pricePerHour",
      header: t("price_hr"),
      cell: ({ row }) => formatCurrency(row.original.pricePerHour),
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => {
        const venue = row.original
        const isPending = venue.status === "pending"
        const isProcessing = approvalMutation.isPending

        return (
          <div className="flex items-center gap-1">
            {isPending && isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => approvalMutation.mutate({ id: venue.id, status: "active" })}
                  disabled={isProcessing}
                  title={t("approve_venue")}
                >
                  <CheckCircle className="h-3.5 w-3.5 me-1" />
                  {t("approve_venue")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => approvalMutation.mutate({ id: venue.id, status: "inactive" })}
                  disabled={isProcessing}
                  title={t("reject_venue")}
                >
                  <XCircle className="h-3.5 w-3.5 me-1" />
                  {t("reject_venue")}
                </Button>
              </>
            )}
            {!isPending && isAdmin && (
              venue.status === "active" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  onClick={() => setToggleTarget(venue)}
                  title={t("deactivate_venue")}
                >
                  <PowerOff className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40"
                  onClick={() => setToggleTarget(venue)}
                  title={t("reactivate_venue")}
                >
                  <Power className="h-4 w-4" />
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setEditVenue(venue); setFormOpen(true) }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(venue)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("venues")}
        subtitle={t("manage_venues")}
        action={
          <Button onClick={() => { setEditVenue(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            {t("add_venue")}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search_venues")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sport} onValueChange={handleFilterChange(setSport)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("all_sports")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_sports")}</SelectItem>
            {SPORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {lang === "ar" ? s.labelAr : s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={handleFilterChange(setStatus)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("all_statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_statuses")}</SelectItem>
            {VENUE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {lang === "ar" ? s.labelAr : s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || sport !== "all" || status !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setSearchInput(""); setSearch(""); setSport("all"); setStatus("all"); resetPage() }}
          >
            <X className="h-3 w-3 me-1" />
            {t("clear_filters")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={venues}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("no_venues")}
        emptyIcon={MapPinIcon}
        emptyAction={
          <Button size="sm" onClick={() => { setEditVenue(null); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {t("add_venue")}
          </Button>
        }
      />

      <VenueFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditVenue(null) }}
        venue={editVenue}
        onSuccess={() => navigate("/venues")}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title={t("delete_venue")}
        description={t("delete_venue_confirm").replace("{name}", deleteTarget?.name ?? "")}
        confirmLabel={t("delete_venue")}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(v) => { if (!v) setToggleTarget(null) }}
        title={
          toggleTarget?.status === "active"
            ? t("deactivate_venue")
            : t("reactivate_venue")
        }
        description={
          (toggleTarget?.status === "active"
            ? t("deactivate_venue_confirm")
            : t("reactivate_venue_confirm")
          ).replace("{name}", toggleTarget?.name ?? "")
        }
        confirmLabel={
          toggleTarget?.status === "active"
            ? t("deactivate_venue")
            : t("reactivate_venue")
        }
        variant={toggleTarget?.status === "active" ? "destructive" : "default"}
        isLoading={toggleMutation.isPending}
        onConfirm={() =>
          toggleTarget &&
          toggleMutation.mutate({
            id: toggleTarget.id,
            status: toggleTarget.status === "active" ? "inactive" : "active",
          })
        }
      />
    </div>
  )
}
