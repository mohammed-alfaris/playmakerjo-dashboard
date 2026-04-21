import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { Users } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { getPlayerLeads, type PlayerLead } from "@/api/leads"
import { usePagination } from "@/hooks/usePagination"
import { formatDate } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

export function PlayerLeadsTable() {
  const { t } = useT()
  const { page, limit, setPage } = usePagination()

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "players", { page, limit }],
    queryFn: () => getPlayerLeads({ page, limit }),
  })

  const leads: PlayerLead[] = data?.data ?? []
  const pagination = data?.pagination ?? { page, limit, total: 0 }

  const columns: ColumnDef<PlayerLead>[] = [
    {
      accessorKey: "email",
      header: t("email"),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.email}</span>
      ),
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
      emptyMessage={t("leads_no_players")}
      emptyIcon={Users}
    />
  )
}
