import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface StadiumKpiProps {
  label: string
  value: string | number
  prefix?: string
  suffix?: string
  delta?: number
  sparkline?: number[]
  sparkColor?: "brand" | "brand-2" | "amber" | "indigo" | "rose"
  isLoading?: boolean
}

const SPARK_COLORS: Record<NonNullable<StadiumKpiProps["sparkColor"]>, string> = {
  brand:    "hsl(var(--brand))",
  "brand-2":"hsl(var(--brand-2))",
  amber:    "hsl(var(--amber))",
  indigo:   "hsl(var(--indigo))",
  rose:     "hsl(var(--rose))",
}

function StadiumSparkline({ points, color }: { points: number[]; color: string }) {
  if (!points || points.length < 2) return <div className="h-7 w-full" />
  const w = 240
  const h = 28
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = w / (points.length - 1)
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)} ${(h - 1 - ((v - min) / range) * (h - 2)).toFixed(2)}`)
    .join(" ")
  const area = `${path} L${w} ${h} L0 ${h} Z`
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block"
      role="img"
      aria-label="trend"
    >
      <path d={area} fill={color} opacity={0.12} />
      <path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StadiumKpi({
  label,
  value,
  prefix,
  suffix,
  delta,
  sparkline,
  sparkColor = "brand",
  isLoading,
}: StadiumKpiProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card p-5 shadow-stadium-sm">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-32" />
        <Skeleton className="mt-3 h-6 w-full" />
      </div>
    )
  }

  const up = delta == null ? null : delta >= 0
  const color = SPARK_COLORS[sparkColor]
  const hasSpark = Array.isArray(sparkline) && sparkline.length >= 2 && sparkline.some((v) => v !== 0)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-stadium-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {label}
        </div>
        {delta != null && (
          <span
            className={cn(
              "chip px-1.5 py-0.5 text-[10px]",
              up ? "chip-brand" : "chip-rose",
            )}
          >
            <span aria-hidden>{up ? "▲" : "▼"}</span>
            <span className="num">{Math.abs(delta).toFixed(1)}%</span>
          </span>
        )}
      </div>

      <div className="display num mt-2 text-[32px] font-semibold leading-none tracking-[-0.03em] text-ink">
        {prefix}
        {value}
        {suffix}
      </div>

      {hasSpark && (
        <div className="mt-3 opacity-90">
          <StadiumSparkline points={sparkline!} color={color} />
        </div>
      )}
    </div>
  )
}
