import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { FileText, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { generateInvoices, getInvoices, type Invoice, type SkippedCompany } from "@/api/billing"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { usePagination } from "@/hooks/usePagination"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { periodLabel, periodOptions } from "@/lib/billing"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { ammanToday } from "@/features/reports/reportLogic"
import { InvoiceBadge } from "./InvoiceBadge"
import { InvoiceDialog } from "./InvoiceDialog"

const FILTERS = ["all", "draft", "issued", "overdue", "paid", "void"] as const
type Filter = (typeof FILTERS)[number]

const selectClass =
  "h-9 rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * PlayMaker's billing, admin side. Pick a month and press Generate: every company that owes
 * something gets a draft. Check the drafts, issue them (the owner is told), record payments.
 */
export default function AdminBillingPage() {
  const { t, lang } = useT()
  const qc = useQueryClient()
  const { page, limit, setPage, resetPage } = usePagination()
  const months = periodOptions(ammanToday())
  const [period, setPeriod] = useState(months[1]) // this month
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<SkippedCompany[] | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", { period, filter, page, limit }],
    queryFn: () => getInvoices({ period, status: filter === "all" ? undefined : filter, page, limit }),
  })

  const generate = useMutation({
    mutationFn: () => generateInvoices(period),
    onSuccess: (r) => {
      toast.success(t("billing_generated").replace("{count}", String(r.created.length)))
      setSkipped(r.skipped.filter((s) => s.reason !== "already_invoiced"))
      qc.invalidateQueries({ queryKey: ["invoices"] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  const columns: ColumnDef<Invoice>[] = [
    {
      id: "number",
      header: t("invoice_number"),
      cell: ({ row }) => <span className="num text-sm font-medium">{row.original.number ?? "—"}</span>,
    },
    {
      id: "company",
      header: t("company"),
      cell: ({ row }) => <span className="text-sm">{(lang === "ar" && row.original.companyNameAr) || row.original.companyName}</span>,
    },
    { id: "total", header: t("receipt_total"), cell: ({ row }) => <span className="num text-sm">{formatCurrency(row.original.total)}</span> },
    { id: "state", header: t("status"), cell: ({ row }) => <InvoiceBadge invoice={row.original} /> },
    { id: "due", header: t("invoice_due_col"), cell: ({ row }) => <span className="num text-sm text-muted-foreground">{row.original.dueOn ?? "—"}</span> },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setOpen(row.original.id)}>
          <FileText className="me-1 h-3.5 w-3.5" />
          {t("action_open")}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_billing")} subtitle={t("billing_admin_subtitle")} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">{t("billing_month")}</span>
          <select className={selectClass} value={period} onChange={(e) => { setPeriod(e.target.value); setSkipped(null); resetPage() }}>
            {months.map((m) => <option key={m} value={m}>{periodLabel(m, lang)}</option>)}
          </select>
        </label>
        <Button className="gap-1.5" disabled={generate.isPending} onClick={() => generate.mutate()}>
          {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {t("billing_generate").replace("{month}", periodLabel(period, lang))}
        </Button>
      </div>

      {skipped && skipped.length > 0 && (
        <div className="rounded-lg border bg-surface-2/60 p-3 text-xs">
          <p className="mb-1.5 font-medium">{t("billing_skipped")}</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {skipped.map((s) => (
              <li key={s.ownerId}>{s.companyName}: {t(`billing_skip_${s.reason}` as TranslationKey)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); resetPage() }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === f ? "border-[hsl(var(--brand))] bg-brand-tint text-brand-ink" : "border-[hsl(var(--line))] text-muted-foreground",
            )}
          >
            {f === "all" ? t("all") : t(`invoice_state_${f}` as TranslationKey)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        pagination={{ page, limit, total: data?.pagination?.total ?? 0 }}
        onPageChange={setPage}
        emptyMessage={t("billing_empty")}
        emptyIcon={FileText}
      />

      <InvoiceDialog invoiceId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
