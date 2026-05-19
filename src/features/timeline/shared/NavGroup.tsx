import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// NavGroup — prev / Today / next as a single bordered pill
// ---------------------------------------------------------------------------

export interface NavGroupProps {
  onPrev: () => void
  onToday: () => void
  onNext: () => void
  isToday: boolean
  todayLabel: string
}

export function NavGroup({ onPrev, onToday, onNext, isToday, todayLabel }: NavGroupProps) {
  return (
    <div className="inline-flex bg-card border border-[hsl(var(--line))] rounded-[10px] overflow-hidden">
      <NavBtn onClick={onPrev} ariaLabel="previous day">
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
      </NavBtn>
      <NavBtn onClick={onToday} wide highlight={!isToday}>
        {todayLabel}
      </NavBtn>
      <NavBtn onClick={onNext} ariaLabel="next day">
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </NavBtn>
    </div>
  )
}

function NavBtn({
  children,
  onClick,
  wide,
  highlight,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  wide?: boolean
  highlight?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center text-[12px] font-semibold bg-transparent border-0 border-s border-[hsl(var(--line))] first:border-s-0 text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]",
        wide ? "h-[34px] px-3.5" : "h-[34px] w-[34px]",
        highlight && "text-[hsl(var(--ink))]",
      )}
    >
      {children}
    </button>
  )
}
