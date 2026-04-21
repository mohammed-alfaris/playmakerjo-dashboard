import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2 } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { getVenueLeads, type VenueLead } from "@/api/leads"
import { usePagination } from "@/hooks/usePagination"
import { formatDate } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

export function VenueLeadsTable() {
  const { t } = useT()
  const { page, limit, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "venues", { page, limit }],
    queryFn: () => getVenueLeads({ page, limit }),
  })

  const leads: VenueLead[] = data?.data ?? []
  const pagination = data?.pagination ?? { page, limit, total: 0 }

  const columns: ColumnDef<VenueLead>[] = [
    {
      id: "contact",
      header: t("leads_contact"),
      cell: ({ row }) => {
        const l = row.original
        return (
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">{l.contactName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{l.email}</p>
          </div>
        )
      },
    },
    {
      accessorKey: "venueName",
      header: t("leads_venue_name"),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.venueName}</span>
      ),
    },
    {
      accessorKey: "city",
      header: t("city"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.city}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: t("phone"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground" dir="ltr">
          {row.original.phone}
        </span>
      ),
    },
    {
      id: "sports",
      header: t("sports"),
      cell: ({ row }) => {
        const sports = row.original.sports
        if (!sports.length) return <span className="text-xs text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {sports.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70"
              >
                {s}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: t("joined"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={leads}
      pagination={pagination}
      onPageChange={setPage}
      isLoading={isLoading}
      emptyMessage={t("leads_no_venues")}
      emptyIcon={Building2}
    />
  )
}
