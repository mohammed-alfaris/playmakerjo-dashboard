import { useQuery } from "@tanstack/react-query"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { ChartCard } from "@/components/shared/ChartCard"
import { getRevenueChart } from "@/api/reports"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

interface RevenueChartProps {
  days?: number
}

export function RevenueChart({ days = 30 }: RevenueChartProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["revenue-chart", days],
    queryFn: () => getRevenueChart(days),
  })
  const { t } = useT()

  const chartData = data?.data ?? []

  return (
    <ChartCard
      title={t("revenue_last_30")}
      isLoading={isLoading}
      isError={isError}
      errorMessage={t("failed_load_chart")}
    >
      <ResponsiveContainer width="100%" height={256}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={(v) => `${v} JOD`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === "revenue" ? t("gross_revenue") : name === "systemRevenue" ? t("system_revenue") : t("owner_revenue"),
            ]}
            labelFormatter={(label) => formatShortDate(String(label))}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend
            formatter={(value: string) =>
              value === "revenue" ? t("gross_revenue") : value === "systemRevenue" ? t("system_revenue") : t("owner_revenue")
            }
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--brand))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="systemRevenue"
            stroke="hsl(36, 77%, 49%)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
