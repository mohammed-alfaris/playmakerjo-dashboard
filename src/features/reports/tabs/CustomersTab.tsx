import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "react-router-dom"
import { getCustomersReport, type ReportParams, type TopCustomer } from "@/api/reports"
import { StadiumKpi } from "@/components/shared/StadiumKpi"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { ChartSkeleton, ReportCard, SimpleTable } from "../charts"
import { deltaPct } from "../reportLogic"
import { ReportError } from "./ReportError"

const money = (n: number) => formatCurrency(n)

/**
 * Who comes back, who pays most, and who on the team took which money. The server leaves out
 * what the caller may not see: customers need customers.view for staff, the team is owner and
 * admin only.
 */
export default function CustomersTab({ params, print = false }: { params: ReportParams; print?: boolean }) {
  const { t } = useT()
  const navigate = useNavigate()
  const { data: r, isLoading, isError, refetch } = useQuery({
    queryKey: ["report", "customers", params],
    queryFn: () => getCustomersReport(params),
  })

  if (isError) return <ReportError onRetry={refetch} />
  if (isLoading || !r) return <ChartSkeleton height={300} />

  const c = r.customers
  const customerRows = (list: TopCustomer[]) => list.map((x) => ({
    key: x.id,
    onClick: print ? undefined : () => navigate(`/customers/${x.id}`),
    cells: {
      name: <span>{x.name} <span className="text-xs text-[hsl(var(--ink-3))]" dir="ltr">{x.phone}</span></span>,
      visits: x.visits,
      paid: money(x.paid),
    },
  }))
  const customerColumns = [
    { key: "name", label: t("report_customer") },
    { key: "visits", label: t("report_visits"), align: "end" as const },
    { key: "paid", label: t("report_paid"), align: "end" as const },
  ]

  return (
    <div className="space-y-5">
      {c && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StadiumKpi label={t("report_active_customers")} value={c.active.value}
              delta={deltaPct(c.active.value, c.active.previous)} />
            <StadiumKpi label={t("report_new_customers")} value={c.new.value} sparkColor="indigo"
              delta={deltaPct(c.new.value, c.new.previous)} />
            <StadiumKpi label={t("report_return_rate")} value={`${c.returnRate}%`}
              sub={t("report_returning_count").replace("{count}", String(c.returning))} />
            <StadiumKpi label={t("report_lapsed")} value={c.lapsed} sparkColor="amber"
              sub={t("report_lapsed_hint")} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ReportCard title={t("report_top_by_visits")}
              action={print ? undefined : <Link to="/customers/report" className="text-xs font-medium text-primary hover:underline">{t("report_monthly_customer_report")}</Link>}>
              <SimpleTable columns={customerColumns} rows={customerRows(c.topByVisits)} />
            </ReportCard>
            <ReportCard title={t("report_top_by_spend")}>
              <SimpleTable columns={customerColumns} rows={customerRows(c.topBySpend)} />
            </ReportCard>
          </div>
        </>
      )}

      {r.team && (
        <ReportCard title={t("report_team")} hint={t("report_team_hint")}>
          <SimpleTable
            columns={[
              { key: "name", label: t("report_person") },
              { key: "payments", label: t("report_payments"), align: "end" },
              { key: "cash", label: t("pay_method_cash"), align: "end" },
              { key: "cliq", label: t("pay_method_cliq"), align: "end" },
              { key: "collected", label: t("report_collected"), align: "end" },
              { key: "counter", label: t("report_counter_bookings"), align: "end" },
            ]}
            rows={r.team.map((m) => ({
              key: m.userId ?? "app",
              cells: {
                name: m.userId == null
                  ? <span className="text-[hsl(var(--ink-3))]">{t("report_via_app")}</span>
                  : <span>{m.name} <span className="text-xs text-[hsl(var(--ink-3))]">· {m.role === "venue_owner" ? t("owner_badge") : t("role_venue_staff")}</span></span>,
                payments: m.payments,
                cash: money(m.cash),
                cliq: money(m.cliq),
                collected: <span className="font-semibold">{money(m.collected)}</span>,
                counter: m.counterBookings,
              },
            }))}
          />
        </ReportCard>
      )}
    </div>
  )
}
