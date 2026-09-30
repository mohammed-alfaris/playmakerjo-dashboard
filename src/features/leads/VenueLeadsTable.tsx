import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { Building2 } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { getVenueLeadStats, getVenueLeads, LEAD_STAGES, type LeadStatus, type VenueLead } from "@/api/leads"
import { usePagination } from "@/hooks/usePagination"
import { formatDate } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { cn } from "@/lib/utils"
import { LeadDialog } from "./LeadDialog"

type Filter = "all" | "due" | LeadStatus

const STAGE_TONE: Record<LeadStatus, string> = {
  new: "bg-[hsl(var(--indigo)/0.12)] text-[hsl(var(--indigo))]",
  contacted: "bg-[hsl(var(--amber)/0.16)] text-[hsl(var(--amber-ink))]",
  demo: "bg-[hsl(var(--amber)/0.16)] text-[hsl(var(--amber-ink))]",
  trial: "bg-[hsl(var(--brand)/0.12)] text-[hsl(var(--brand-ink))]",
  won: "bg-[hsl(var(--brand)/0.2)] text-[hsl(var(--brand-ink))]",
  lost: "bg-muted text-muted-foreground",
}

/**
 * Venue sign-ups from the website as a sales pipeline: each one has a stage and a date to
 * call back, and "Due" lists the calls that are owed today.
 */
export function VenueLeadsTable() {
  const { t } = useT()
  const { page, limit, setPage, resetPage } = usePagination()
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<VenueLead | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["leads", "venues", { page, limit, filter }],
    queryFn: () => getVenueLeads({ page, limit, status: filter === "all" ? undefined : filter }),
  })
  const { data: stats } = useQuery({ queryKey: ["leads", "venue-stats"], queryFn: getVenueLeadStats })

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
            <p className="mt-0.5 text-xs text-muted-foreground">{l.email}</p>
          </div>
        )
      },
    },
    {
      id: "venue",
      header: t("leads_venue_name"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm">{row.original.venueName}</p>
          <p className="text-xs text-muted-foreground">{row.original.city} · <span dir="ltr">{row.original.phone}</span></p>
        </div>
      ),
    },
    {
      id: "stage",
      header: t("lead_stage"),
      cell: ({ row }) => (
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", STAGE_TONE[row.original.status])}>
          {t(`lead_stage_${row.original.status}` as TranslationKey)}
        </span>
      ),
    },
    {
      id: "follow",
      header: t("lead_follow_up"),
      cell: ({ row }) => row.original.nextFollowUpOn ? (
        <span className={cn("num text-sm", row.original.followUpDue ? "font-semibold text-[hsl(var(--rose-ink))]" : "text-muted-foreground")}>
          {row.original.nextFollowUpOn}
        </span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: "createdAt",
      header: t("joined"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => <Button variant="ghost" size="sm" onClick={() => setOpen(row.original)}>{t("action_open")}</Button>,
    },
  ]

  const chips: { key: Filter; label: string; count?: number; warn?: boolean }[] = [
    { key: "all", label: t("all") },
    { key: "due", label: t("lead_due"), count: stats?.followUpsDue, warn: (stats?.followUpsDue ?? 0) > 0 },
    ...LEAD_STAGES.map((s) => ({ key: s as Filter, label: t(`lead_stage_${s}` as TranslationKey), count: stats?.byStatus[s] })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => { setFilter(c.key); resetPage() }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === c.key ? "border-[hsl(var(--brand))] bg-brand-tint text-brand-ink" : "border-[hsl(var(--line))] text-muted-foreground",
            )}
          >
            {c.label}
            {c.count != null && <span className={cn("num ms-1.5", c.warn && "font-bold text-[hsl(var(--rose-ink))]")}>{c.count}</span>}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={leads}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("leads_no_venues")}
        emptyIcon={Building2}
      />

      <LeadDialog lead={open} onClose={() => setOpen(null)} />
    </div>
  )
}
