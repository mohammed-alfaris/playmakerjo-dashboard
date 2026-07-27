import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Search, Contact2, AlertTriangle, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ColumnDef } from "@tanstack/react-table"
import { getCustomers, type Customer, type CustomerSegment } from "@/api/customers"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { usePagination } from "@/hooks/usePagination"
import { useT } from "@/i18n/LanguageContext"
import { formatDate, formatCurrency } from "@/lib/formatters"
import CustomerDetailSheet from "./CustomerDetailSheet"

const SEGMENTS: { key: CustomerSegment; labelKey: Parameters<ReturnType<typeof useT>["t"]>[0] }[] = [
  { key: "all", labelKey: "segment_all" },
  { key: "regulars", labelKey: "segment_regulars" },
  { key: "lapsed", labelKey: "segment_lapsed" },
  { key: "unreliable", labelKey: "segment_unreliable" },
  { key: "owing", labelKey: "segment_owing" },
]

export default function CustomersPage() {
  const { t } = useT()
  const { page, limit, setPage, resetPage } = usePagination()
  const [rawSearch, setRawSearch] = useState("")
  const [search, setSearch] = useState("")
  const [segment, setSegment] = useState<CustomerSegment>("all")
  const [openId, setOpenId] = useState<string | null>(null)

  // resetPage is memoised (see usePagination) so this fires only when the term really
  // changes — before that fix it re-armed every render and dragged the list back to page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(rawSearch)
      resetPage()
    }, 400)
    return () => clearTimeout(id)
  }, [rawSearch, resetPage])

  const { data, isLoading, isError } = useQuery({
    queryKey: ["customers", page, limit, search, segment],
    queryFn: () => getCustomers({ page, limit, search: search || undefined, segment }),
  })

  const columns: ColumnDef<Customer>[] = [
    {
      id: "person",
      header: t("customer_name"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {row.original.name || t("walk_in_customer")}
          </div>
          {/* dir="ltr" so a +962 number is not mirrored in the Arabic UI. */}
          <div className="truncate text-xs text-muted-foreground" dir="ltr">
            {row.original.phone}
          </div>
        </div>
      ),
    },
    {
      id: "visits",
      header: t("stat_visits"),
      cell: ({ row }) => {
        const s = row.original.stats
        return (
          <div className="flex items-center gap-1.5">
            <span className="num text-sm font-semibold">{s.attended}</span>
            {s.isRegular && (
              <span className="rounded-full bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">
                {t("segment_regulars")}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: "noShow",
      header: t("stat_no_shows"),
      cell: ({ row }) => {
        const s = row.original.stats
        if (s.noShow === 0) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
              (s.isUnreliable ? "bg-rose-tint text-rose-ink" : "bg-amber-tint text-amber-ink")
            }
          >
            <AlertTriangle className="h-3 w-3" />
            {s.noShow} · {s.noShowRate}%
          </span>
        )
      },
    },
    {
      id: "owed",
      header: t("stat_owed"),
      cell: ({ row }) =>
        row.original.stats.amountOwed > 0 ? (
          <span className="num text-sm font-semibold text-amber-ink">
            {formatCurrency(row.original.stats.amountOwed)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "lastVisit",
      header: t("stat_last_visit"),
      cell: ({ row }) => {
        const s = row.original.stats
        if (!s.lastVisit) return <span className="text-sm text-muted-foreground">{t("customer_never_visited")}</span>
        return (
          <div>
            <div className="text-sm">{formatDate(s.lastVisit)}</div>
            {s.isLapsed && (
              <div className="text-[11px] font-medium text-amber-ink">
                {t("customer_last_seen").replace("{n}", String(s.daysSinceLastVisit))}
              </div>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* No "add customer" action, deliberately. The book builds itself from bookings —
          a screen that asked the owner to key in a customer database would never be used. */}
      <PageHeader
        title={t("nav_customers")}
        subtitle={t("customers_subtitle")}
        action={
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/customers/report">
              <BarChart3 className="h-3.5 w-3.5" />
              {t("report_monthly")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          {/* start/ps rather than left/pl so the icon flips with the language. */}
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder={t("customers_search")}
            className="h-9 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSegment(s.key)
                resetPage()
              }}
              className={
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                (segment === s.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted/40")
              }
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        // A failed load must not look like an empty customer book — that reads as data loss.
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {t("something_went_wrong")}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          pagination={{ page, limit, total: data?.pagination?.total ?? 0 }}
          onPageChange={setPage}
          emptyMessage={t("customers_empty")}
          emptyIcon={Contact2}
          onRowClick={(row) => setOpenId(row.id)}
        />
      )}

      <CustomerDetailSheet customerId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
