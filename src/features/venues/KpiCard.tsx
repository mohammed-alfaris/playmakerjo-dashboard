import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// KpiCard — 4-card row with optional sparkline, used in VenueDetailPage
// ---------------------------------------------------------------------------

type Tone = "brand" | "amber" | "sky" | "indigo"

export function KpiCard({
  label,
  value,
  sublabel,
  icon,
  tone,
  series,
  isLoading,
}: {
  label: string
  value: string
  sublabel?: string
  icon?: React.ReactNode
  tone: Tone
  series?: number[]
  isLoading?: boolean
}) {
  const toneCls = {
    brand: "bg-[hsl(var(--brand-tint))] text-[hsl(var(--brand-ink))]",
    amber: "bg-[hsl(var(--amber-tint))] text-[hsl(var(--amber-ink))]",
    sky: "bg-[hsl(var(--sky-tint))] text-[hsl(var(--sky-ink))]",
    indigo: "bg-[hsl(var(--indigo-tint))] text-[hsl(var(--indigo-ink))]",
  }[tone]
  return (
    <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] shadow-sm-stadium p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
          {label}
        </div>
        {icon && (
          <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md", toneCls)}>
            {icon}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <>
          <div className="display text-[24px] font-semibold leading-none text-[hsl(var(--ink))] tracking-[-0.01em]">
            {value}
          </div>
          {sublabel && (
            <div className="text-[11px] text-[hsl(var(--ink-3))]">{sublabel}</div>
          )}
        </>
      )}
      <Sparkline data={series} tone={tone} />
    </div>
  )
}

function Sparkline({ data, tone }: { data?: number[]; tone: Tone }) {
  const toneBg = {
    brand: "bg-[hsl(var(--brand))]",
    amber: "bg-[hsl(var(--amber))]",
    sky: "bg-[hsl(var(--sky))]",
    indigo: "bg-[hsl(var(--indigo))]",
  }[tone]
  const points = data && data.length > 0 ? data : new Array(12).fill(0)
  const max = Math.max(1, ...points)
  return (
    <div className="flex items-end gap-[2px] h-6">
      {points.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-[2px] opacity-70", toneBg)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}
