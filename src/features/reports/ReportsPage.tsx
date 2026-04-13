import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Loader2, DollarSign, CalendarCheck, MapPin, Percent, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getSummary, exportReport } from "@/api/reports"
import { getVenues } from "@/api/venues"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

const DATE_INPUT_CLASS =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function thirtyDaysAgoStr() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split("T")[0]
}

export default function ReportsPage() {
  const { isAdmin } = useRole()
  const ownerFilter = useOwnerFilter()
  const { t } = useT()

  const [from,     setFrom]    = useState(thirtyDaysAgoStr)
  const [to,       setTo]      = useState(todayStr)
  const [venue_id, setVenueId] = useState("all")
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null)

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["reports-summary", ownerFilter],
    queryFn: () => getSummary(ownerFilter),
  })
  const summary = summaryData?.data

  const { data: venuesData } = useQuery({
    queryKey: ["venues-for-reports", ownerFilter],
    queryFn: () => getVenues({ limit: 100, ...ownerFilter }),
  })
  const venueOptions = venuesData?.data ?? []

  async function handleExport(format: "csv" | "pdf") {
    setExporting(format)
    try {
      const blob = await exportReport({
        format,
        from:     from     || undefined,
        to:       to       || undefined,
        venue_id: venue_id !== "all" ? venue_id : undefined,
      })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `report-${from}-${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} exported successfully`)
    } catch {
      toast.error(t("export_failed"))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports")}
        subtitle={t("export_review")}
      />

      {/* Filter + Export bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={DATE_INPUT_CLASS}
          title={t("from_date")}
        />
        <span className="text-sm text-muted-foreground">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={DATE_INPUT_CLASS}
          title={t("to_date")}
        />

        <Select value={venue_id} onValueChange={setVenueId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("all_venues")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_venues")}</SelectItem>
            {venueOptions.map((v: { id: string; name: string }) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
          >
            {exporting === "csv"
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />
            }
            {t("export_csv")}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
          >
            {exporting === "pdf"
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />
            }
            {t("export_pdf")}
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      {isAdmin ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t("gross_revenue")}
            value={summary ? formatCurrency(summary.totalRevenue) : "—"}
            icon={DollarSign}
            color="green"
            isLoading={summaryLoading}
          />
          <StatCard
            title={t("platform_revenue")}
            value={summary ? formatCurrency(summary.systemRevenue) : "—"}
            icon={Percent}
            color="amber"
            isLoading={summaryLoading}
          />
          <StatCard
            title={t("total_bookings")}
            value={summary?.totalBookings ?? "—"}
            icon={CalendarCheck}
            color="blue"
            isLoading={summaryLoading}
          />
          <StatCard
            title={t("owner_payouts")}
            value={summary ? formatCurrency(summary.ownerRevenue) : "—"}
            icon={TrendingUp}
            color="purple"
            isLoading={summaryLoading}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title={t("my_revenue")}
            value={summary ? formatCurrency(summary.totalRevenue) : "—"}
            icon={DollarSign}
            color="green"
            isLoading={summaryLoading}
          />
          <StatCard
            title={t("my_bookings")}
            value={summary?.totalBookings ?? "—"}
            icon={CalendarCheck}
            color="blue"
            isLoading={summaryLoading}
          />
          <StatCard
            title={t("my_venues")}
            value={summary?.totalVenues ?? "—"}
            icon={MapPin}
            color="purple"
            isLoading={summaryLoading}
          />
        </div>
      )}
    </div>
  )
}
