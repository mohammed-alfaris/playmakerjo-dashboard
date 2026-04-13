import { useQuery } from "@tanstack/react-query"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { ChartCard } from "@/components/shared/ChartCard"
import { getTopVenues } from "@/api/reports"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"]

export function TopVenuesChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["top-venues"],
    queryFn: getTopVenues,
  })
  const { t } = useT()

  const chartData = data?.data ?? []

  return (
    <ChartCard
      title={t("top_venues")}
      isLoading={isLoading}
      isError={isError}
      errorMessage={t("failed_load_chart")}
    >
      <ResponsiveContainer width="100%" height={256}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
          <XAxis
            type="number"
            tickFormatter={(v) => `${v}`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={140}
            tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "…" : v}
          />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {chartData.map((_: unknown, index: number) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
