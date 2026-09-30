import { useState, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { type ColumnDef } from "@tanstack/react-table"
import { CreditCard, X, Store, Smartphone, Wallet } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { DataTable } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { getPayments, getPaymentTotals, type Payment } from "@/api/payments"
import { usePagination } from "@/hooks/usePagination"
import { useRole } from "@/hooks/useRole"
import { formatCurrency, formatDateTime } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

/**
 * The money ledger.
 *
 * Deliberately has no status column or status filter. Every row this table can contain is
 * money that has already arrived — the backend writes nothing else — so a status column
 * would repeat "paid" down the page and a filter would offer choices that match nothing.
 * Money still owed is the ABSENCE of a row here, and it is shown where it is actionable:
 * on the booking and on the customer.
 *
 * Nothing on this page can edit a row, because nothing anywhere can: payments are
 * append-only. A correction is a new row, entered through the booking it belongs to.
 */

type RangeKey = "today" | "month" | "all"

/** Local calendar dates — the owner's day, not UTC's. */
function rangeFor(key: RangeKey): { from?: string; to?: string } {
  if (key === "all") return {}
  const now = new Date()
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const today = iso(now)
  if (key === "today") return { from: today, to: today }
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
}

export default function PaymentsPage() {
  const { page, limit, setPage, resetPage } = usePagination()
  const [range, setRange] = useState<RangeKey>("month")
  const [method, setMethod] = useState("all")
  const { t } = useT()
  const { isAdmin } = useRole()

  const filters = useMemo(() => ({
    ...rangeFor(range),
    method: method === "all" ? undefined : method,
  }), [range, method])

  const onRangeChange = useCallback(
    (v: string) => { setRange(v as RangeKey); resetPage() },
    [resetPage],
  )
  const onMethodChange = useCallback(
    (v: string) => { setMethod(v); resetPage() },
    [resetPage],
  )

  const { data, isLoading } = useQuery({
    queryKey: ["payments", { page, limit, ...filters }],
    queryFn: () => getPayments({ page, limit, ...filters }),
  })

  // Same filter, summed over every matching row rather than the page on screen.
  const { data: totals } = useQuery({
    queryKey: ["payment-totals", filters],
    queryFn: () => getPaymentTotals(filters),
  })

  const payments: Payment[] = data?.data ?? []
  const pagination = data?.pagination ?? { page, limit, total: 0 }

  const kindLabel: Record<string, string> = {
    deposit: t("payment_kind_deposit"),
    balance: t("payment_kind_balance"),
    full: t("payment_kind_full"),
  }

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "date",
      header: t("date_time"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground" dir="ltr">
          {formatDateTime(row.original.date)}
        </span>
      ),
    },
    {
      id: "payer",
      header: t("paid_by"),
      // payerName, never player.name: on a counter booking the player IS the owner.
      cell: ({ row }) => (
        <span className="font-medium">{row.original.payerName || "—"}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: t("amount"),
      cell: ({ row }) => (
        <span className="font-medium" dir="ltr">{formatCurrency(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: t("payment_kind"),
      cell: ({ row }) => (
        <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">
          {kindLabel[row.original.kind] ?? row.original.kind}
        </span>
      ),
    },
    {
      accessorKey: "method",
      header: t("method"),
      cell: ({ row }) => {
        const m = row.original.method
        const Icon = m === "cash" ? Store : m === "cliq" ? Smartphone : Wallet
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            <span className="uppercase">{m || "—"}</span>
          </span>
        )
      },
    },
    {
      id: "recordedBy",
      header: t("recorded_by"),
      // Blank rather than a guess when the row predates the ledger. Naming someone who
      // may not have been there is worse than admitting the record does not say.
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.recordedBy?.name ?? "—"}
        </span>
      ),
    },
    ...(isAdmin
      ? [{
          id: "venue",
          header: t("venue"),
          cell: ({ row }: { row: { original: Payment } }) => (
            <span className="text-sm text-muted-foreground">{row.original.venue?.name ?? "—"}</span>
          ),
        } as ColumnDef<Payment>]
      : []),
    {
      accessorKey: "bookingRef",
      header: t("booking_ref"),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          #{row.original.bookingRef}
        </span>
      ),
    },
  ]

  const filtered = range !== "month" || method !== "all"

  return (
    <div className="space-y-6">
      <PageHeader title={t("payments")} subtitle={t("payments_ledger_subtitle")} />

      {totals && (
        <div className="flex flex-wrap items-end gap-6 rounded-xl border border-line bg-card p-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              {t("total_received")}
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums" dir="ltr">
              {formatCurrency(totals.total)}
            </div>
          </div>
          <div className="text-sm text-ink-3">
            {t("payments_count").replace("{count}", String(totals.count))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals.byMethod).map(([m, sum]) => (
              <span
                key={m}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2"
              >
                <span className="uppercase">{m}</span>
                <span className="tabular-nums" dir="ltr">{formatCurrency(sum)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={range} onValueChange={onRangeChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t("range_today")}</SelectItem>
            <SelectItem value="month">{t("range_this_month")}</SelectItem>
            <SelectItem value="all">{t("range_all_time")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={method} onValueChange={onMethodChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_methods")}</SelectItem>
            <SelectItem value="cash">{t("method_cash")}</SelectItem>
            <SelectItem value="cliq">CliQ</SelectItem>
          </SelectContent>
        </Select>

        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => { setRange("month"); setMethod("all"); resetPage() }}
          >
            <X className="h-3 w-3 me-1" />
            {t("clear_filters")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={payments}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage={t("no_payments")}
        emptyIcon={CreditCard}
      />
    </div>
  )
}
