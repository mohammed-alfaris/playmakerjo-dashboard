import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Building2, Eye, Receipt, Search, SlidersHorizontal } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getCompanies, type Company } from "@/api/companies"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { UsageMeter } from "@/components/shared/UsageMeter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePagination } from "@/hooks/usePagination"
import { useT } from "@/i18n/LanguageContext"
import { formatDate } from "@/lib/formatters"
import { useViewAsStore } from "@/store/viewAsStore"
import LimitsDialog from "./LimitsDialog"
import { CompanyBillingDialog } from "./CompanyBillingDialog"
import { cn } from "@/lib/utils"

/**
 * Every venue owner's account as a company: who owns it, how much of their allowance they
 * use, and the limits PlayMaker set. Editing a limit is the only write here.
 */
export default function CompaniesPage() {
  const { t, lang } = useT()
  const { page, limit, setPage, resetPage } = usePagination()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Company | null>(null)
  // By id, so the dialog always shows the company as the list last loaded it — a suspension
  // or price change shows at once instead of the copy taken when the dialog opened.
  const [billingId, setBillingId] = useState<string | null>(null)
  const viewAs = useViewAsStore((s) => s.viewAs)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); resetPage() }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, resetPage])

  const { data, isLoading, isError } = useQuery({
    queryKey: ["companies", { page, limit, search }],
    queryFn: () => getCompanies({ page, limit, search: search || undefined }),
  })

  const columns: ColumnDef<Company>[] = [
    {
      id: "company",
      header: t("company"),
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{lang === "ar" && c.nameAr ? c.nameAr : c.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {/* A company starts named after its owner; say the name twice only once it differs. */}
              {c.name !== c.ownerName && <>{c.ownerName} · </>}
              <span dir="ltr">{c.ownerEmail}</span>
            </div>
          </div>
        )
      },
    },
    {
      id: "venues",
      header: t("usage_venues"),
      cell: ({ row }) => <UsageMeter label="" usage={row.original.venues} className="w-36" />,
    },
    {
      id: "staff",
      header: t("usage_staff"),
      cell: ({ row }) => <UsageMeter label="" usage={row.original.staff} className="w-36" />,
    },
    {
      id: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.ownerStatus} />,
    },
    {
      id: "billing",
      header: t("nav_billing"),
      cell: ({ row }) => {
        const b = row.original.billing
        if (!b) return null
        return (
          <div className="space-y-0.5">
            <span className={cn(
              "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
              b.status === "suspended" ? "bg-[hsl(var(--rose)/0.14)] text-[hsl(var(--rose-ink))]"
                : b.status === "trial" ? "bg-[hsl(var(--amber)/0.16)] text-[hsl(var(--amber-ink))]"
                : "bg-[hsl(var(--brand)/0.14)] text-[hsl(var(--brand-ink))]",
            )}>
              {b.status === "trial" && b.trialEndsOn
                ? t("billing_trial_until").replace("{date}", b.trialEndsOn)
                : t(b.status === "suspended" ? "billing_status_suspended" : "billing_status_active")}
            </span>
            {b.overdueCount > 0 && (
              <div className="text-[11px] font-medium text-[hsl(var(--rose-ink))]">
                {t("billing_overdue_short").replace("{count}", String(b.overdueCount))}
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: "since",
      header: t("joined"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setBillingId(row.original.id)}>
            <Receipt className="me-1.5 h-3.5 w-3.5" />
            {t("nav_billing")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
            <SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />
            {t("limits_edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title={t("view_as_hint")}
            onClick={() => {
              viewAs(row.original.id, (lang === "ar" && row.original.nameAr) || row.original.name)
              navigate("/")
            }}
          >
            <Eye className="me-1.5 h-3.5 w-3.5" />
            {t("view_as")}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_companies")} subtitle={t("companies_subtitle")} />

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("companies_search")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="ps-9"
        />
      </div>

      {isError ? (
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
          emptyMessage={t("companies_empty")}
          emptyIcon={Building2}
        />
      )}

      <LimitsDialog company={editing} onOpenChange={(open) => { if (!open) setEditing(null) }} />
      <CompanyBillingDialog
        company={data?.data.find((c) => c.id === billingId) ?? null}
        onClose={() => setBillingId(null)}
      />
    </div>
  )
}
