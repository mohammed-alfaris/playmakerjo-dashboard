import { TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  color?: "blue" | "green" | "amber" | "purple" | "red"
  isLoading?: boolean
  /** Series of recent values, oldest → newest. Renders a tiny inline sparkline when present. */
  sparkline?: number[]
}

const SPARK_W = 72
const SPARK_H = 24

/**
 * Inline SVG sparkline. Pure presentational — inherits `currentColor` from its container
 * so it picks up the card's color token automatically.
 */
function Sparkline({ points, ariaLabel }: { points: number[]; ariaLabel: string }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = SPARK_W / (points.length - 1)
  const path = points
    .map((v, i) => {
      const x = i * step
      const y = SPARK_H - ((v - min) / range) * SPARK_H
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
  // Closed area path for the fill underneath the line.
  const area = `${path} L${SPARK_W} ${SPARK_H} L0 ${SPARK_H} Z`
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={ariaLabel}
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const COLOR_MAP = {
  blue:   { border: "border-l-blue-500",   iconBg: "bg-blue-100 dark:bg-blue-950",    iconText: "text-blue-600 dark:text-blue-400",    grad: "from-blue-50/60 dark:from-blue-950/30" },
  green:  { border: "border-l-green-500",  iconBg: "bg-green-100 dark:bg-green-950",  iconText: "text-green-600 dark:text-green-400",  grad: "from-green-50/60 dark:from-green-950/30" },
  amber:  { border: "border-l-amber-500",  iconBg: "bg-amber-100 dark:bg-amber-950",  iconText: "text-amber-600 dark:text-amber-400",  grad: "from-amber-50/60 dark:from-amber-950/30" },
  purple: { border: "border-l-purple-500", iconBg: "bg-purple-100 dark:bg-purple-950", iconText: "text-purple-600 dark:text-purple-400", grad: "from-purple-50/60 dark:from-purple-950/30" },
  red:    { border: "border-l-red-500",    iconBg: "bg-red-100 dark:bg-red-950",      iconText: "text-red-600 dark:text-red-400",      grad: "from-red-50/60 dark:from-red-950/30" },
}

export function StatCard({ title, value, change, icon: Icon, color = "blue", isLoading, sparkline }: StatCardProps) {
  const { border, iconBg, iconText, grad } = COLOR_MAP[color]
  const isPositive = (change ?? 0) >= 0
  const hasSparkline = Array.isArray(sparkline) && sparkline.length >= 2 && sparkline.some((v) => v !== 0)

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-muted">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-l-4 bg-gradient-to-br to-transparent", border, grad)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {change !== undefined && (
              <div className={cn("flex items-center gap-1 text-xs font-medium", isPositive ? "text-green-600" : "text-red-600")}>
                {isPositive
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />
                }
                <span>{isPositive ? "+" : ""}{change.toFixed(1)}% from last month</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconBg)}>
              <Icon className={cn("h-5 w-5", iconText)} />
            </div>
            {hasSparkline && (
              <div className={iconText}>
                <Sparkline points={sparkline!} ariaLabel={`${title} trend`} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
