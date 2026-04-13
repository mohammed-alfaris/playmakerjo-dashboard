import { useQuery } from "@tanstack/react-query"
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { ChartCard } from "@/components/shared/ChartCard"
import { getSportsBreakdown } from "@/api/reports"
import { useT } from "@/i18n/LanguageContext"

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6"]

export function SportsPieChart() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sports-breakdown"],
    queryFn: getSportsBreakdown,
  })
  const { t } = useT()

  const chartData = data?.data ?? []

  return (
    <ChartCard
      title={t("sports_breakdown")}
      isLoading={isLoading}
      isError={isError}
      errorMessage={t("failed_load_chart")}
    >
      <ResponsiveContainer width="100%" height={256}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="sport"
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
          >
            {chartData.map((_: unknown, index: number) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [Number(value), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
