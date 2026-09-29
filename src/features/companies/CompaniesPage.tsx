import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Building2, Search, SlidersHorizontal } from "lucide-react"
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
import LimitsDialog from "./LimitsDialog"

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
        <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
          <SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />
          {t("limits_edit")}
        </Button>
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
    </div>
  )
}
