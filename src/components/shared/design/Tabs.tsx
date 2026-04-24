import type { ReactNode, CSSProperties } from "react"
import { cn } from "@/lib/utils"

export interface TabSpec<T extends string = string> {
  id: T
  label: ReactNode
  icon?: ReactNode
  badge?: ReactNode
}

export interface TabsProps<T extends string = string> {
  tabs: TabSpec<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  style?: CSSProperties
}

/**
 * Horizontal segmented tab strip used by the V1 Venue Profile. Active tab
 * surfaces a `bg-card` chip with subtle shadow; inactive tabs are transparent.
 */
export function Tabs<T extends string>({ tabs, active, onChange, className, style }: TabsProps<T>) {
  return (
    <div
      className={cn("inline-flex gap-[2px] p-[3px] rounded-[12px] bg-[hsl(var(--surface-2))]", className)}
      style={style}
      role="tablist"
    >
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "inline-flex items-center gap-[6px] h-[30px] px-[14px] rounded-[9px] text-[12.5px] font-semibold transition-colors",
              isActive
                ? "bg-card text-[hsl(var(--ink))] shadow-sm-stadium"
                : "bg-transparent text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))]",
            )}
          >
            {t.icon}
            {t.label}
            {t.badge != null && (
              <span
                className={cn(
                  "rounded-full text-[10px] font-bold px-[6px] py-[1px]",
                  isActive ? "bg-[hsl(var(--surface-2))] text-[hsl(var(--ink-3))]" : "bg-card text-[hsl(var(--ink-3))]",
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
