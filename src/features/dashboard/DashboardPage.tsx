import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { DollarSign, CalendarCheck, MapPin, TrendingUp, Plus, UserPlus, Download, Percent } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard } from "@/components/shared/StatCard"
import { Button } from "@/components/ui/button"
import { RevenueChart } from "./RevenueChart"
import { TopVenuesChart } from "./TopVenuesChart"
import { SportsPieChart } from "./SportsPieChart"
import { RecentBookingsTable } from "./RecentBookingsTable"
import { getSummary } from "@/api/reports"
import { useRole, useOwnerFilter } from "@/hooks/useRole"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"

const DATE_RANGES = [
  { label: "7D",  value: 7  },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
]

export default function DashboardPage() {
  const { isAdmin, isOwner } = useRole()
  const ownerFilter = useOwnerFilter()
  const { t } = useT()
  const navigate = useNavigate()
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary", ownerFilter],
    queryFn: () => getSummary(ownerFilter),
  })

  const summary = data?.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard")}
        subtitle={isOwner ? t("your_overview") : t("platform_overview")}
      />

      {/* Quick Actions — admin only */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider me-1">
            {t("quick_actions")}
          </span>
          <Button size="sm" onClick={() => navigate("/venues")}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {t("add_venue")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/users")}>
            <UserPlus className="h-3.5 w-3.5 me-1.5" />
            {t("add_user")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/reports")}>
            <Download className="h-3.5 w-3.5 me-1.5" />
            {t("export_csv")}
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t("gross_revenue")}
            value={summary ? formatCurrency(summary.totalRevenue) : "—"}
            change={summary?.revenueChange}
            icon={DollarSign}
            color="green"
            isLoading={isLoading}
          />
          <StatCard
            title={t("platform_revenue")}
            value={summary ? formatCurrency(summary.systemRevenue) : "—"}
            icon={Percent}
            color="amber"
            isLoading={isLoading}
          />
          <StatCard
            title={t("total_bookings")}
            value={summary?.totalBookings ?? "—"}
            change={summary?.bookingsChange}
            icon={CalendarCheck}
            color="blue"
            isLoading={isLoading}
          />
          <StatCard
            title={t("owner_payouts")}
            value={summary ? formatCurrency(summary.ownerRevenue) : "—"}
            icon={TrendingUp}
            color="purple"
            isLoading={isLoading}
          />
        </div>
      )}

      {isOwner && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title={t("my_venues")}
            value={summary?.totalVenues ?? "—"}
            icon={MapPin}
            color="purple"
            isLoading={isLoading}
          />
          <StatCard
            title={t("my_bookings")}
            value={summary?.totalBookings ?? "—"}
            icon={CalendarCheck}
            color="blue"
            isLoading={isLoading}
          />
          <StatCard
            title={t("my_revenue")}
            value={summary ? formatCurrency(summary.totalRevenue) : "—"}
            icon={DollarSign}
            color="green"
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Charts — admin only */}
      {isAdmin && (
        <>
          {/* Date range pills */}
          <div className="flex items-center gap-2">
            {DATE_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  days === r.value
                    ? "bg-brand text-white border-brand"
                    : "border-border text-muted-foreground hover:border-brand hover:text-brand"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <RevenueChart days={days} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TopVenuesChart />
            </div>
            <div className="lg:col-span-2">
              <SportsPieChart />
            </div>
          </div>
        </>
      )}

      {/* Recent Bookings activity feed */}
      <RecentBookingsTable ownerFilter={ownerFilter} />
    </div>
  )
}
