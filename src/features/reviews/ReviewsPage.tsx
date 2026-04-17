import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { Star, EyeOff, X } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { getReviews, hideReview, type Review } from "@/api/reviews"
import { getVenues } from "@/api/venues"
import { usePagination } from "@/hooks/usePagination"
import { formatDateTime } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + "\u2026"
}

export default function ReviewsPage() {
  const { page, limit, setPage, resetPage } = usePagination()
  const { t } = useT()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<"all" | "visible" | "hidden">("all")
  const [venueId, setVenueId] = useState<string>("all")
  const [hideTargetId, setHideTargetId] = useState<string | null>(null)

  const handleFilterChange = useCallback(
    (setter: (v: string) => void) => (v: string) => { setter(v); resetPage() },
    [resetPage]
  )

  const { data, isLoading } = useQuery({
    queryKey: ["reviews", { page, limit, status, venueId }],
    queryFn: () => getReviews({
      page,
      limit,
      status: status === "all" ? undefined : status,
      venueId: venueId === "all" ? undefined : venueId,
    }),
  })

  const { data: venuesData } = useQuery({
    queryKey: ["venues-for-reviews"],
    queryFn: () => getVenues({ limit: 100 }),
  })

  const hideMutation = useMutation({
    mutationFn: (id: string) => hideReview(id),
    onSuccess: () => {
      toast.success(t("reviewHidden"))
      queryClient.invalidateQueries({ queryKey: ["reviews"] })
      setHideTargetId(null)
    },
    onError: () => toast.error(t("reviewHidden")),
  })

  const reviews: Review[] = data?.data ?? []
  const pagination = data?.pagination ?? { page, limit, total: 0 }
  const venueOptions: { id: string; name: string }[] = venuesData?.data ?? []

  const columns: ColumnDef<Review>[] = [
    {
      id: "player",
      header: t("player"),
      cell: ({ row }) => {
        const r = row.original
        const initials = r.playerName
          ? r.playerName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
          : "?"
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              {r.playerAvatar && <AvatarImage src={r.playerAvatar} alt={r.playerName} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{r.playerName}</span>
          </div>
        )
      },
    },
    {
      id: "venue",
      header: t("filterVenue"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.venueName ?? row.original.venueId}</span>
      ),
    },
    {
      id: "rating",
      header: "★",
      cell: ({ row }) => <StarRating rating={row.original.rating} />,
    },
    {
      id: "comment",
      header: t("reviewComment"),
      cell: ({ row }) => {
        const c = row.original.comment ?? ""
        if (!c) return <span className="text-xs text-muted-foreground/50">—</span>
        const short = truncate(c, 80)
        if (short === c) {
          return <span className="text-sm">{c}</span>
        }
        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm cursor-help">{short}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-xs whitespace-pre-wrap">{c}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      },
    },
    {
      id: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "status",
      header: t("filterStatus"),
      cell: ({ row }) =>
        row.original.hidden ? (
          <Badge variant="outline" className="font-medium bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
            {t("hidden")}
          </Badge>
        ) : (
          <Badge variant="outline" className="font-medium bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
            {t("visible")}
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original
        if (r.hidden) return null
        return (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setHideTargetId(r.id)}
          >
            <EyeOff className="h-3 w-3 me-1" />
            {t("hideReview")}
          </Button>
        )
      },
    },
  ]

  const hasActiveFilters = status !== "all" || venueId !== "all"

  return (
    <div className="space-y-6">
      <PageHeader title={t("reviews")} subtitle={t("reviewModeration")} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={status} onValueChange={handleFilterChange((v) => setStatus(v as typeof status))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allReviews")}</SelectItem>
            <SelectItem value="visible">{t("visible")}</SelectItem>
            <SelectItem value="hidden">{t("hidden")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={venueId} onValueChange={handleFilterChange(setVenueId)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("filterVenue")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_venues")}</SelectItem>
            {venueOptions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setStatus("all"); setVenueId("all"); resetPage() }}
          >
            <X className="h-3 w-3 me-1" />
            {t("clear_filters")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("noReviewsFound")}
        emptyIcon={Star}
      />

      <ConfirmDialog
        title={t("hideReview")}
        description={t("hideReviewConfirm")}
        open={!!hideTargetId}
        onOpenChange={(open) => { if (!open) setHideTargetId(null) }}
        onConfirm={() => hideTargetId && hideMutation.mutate(hideTargetId)}
        isLoading={hideMutation.isPending}
        confirmLabel={t("hideReview")}
      />
    </div>
  )
}
