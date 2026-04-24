import type { ReactNode, CSSProperties } from "react"
import { cn } from "@/lib/utils"

export interface SegmentedOption<V extends string = string> {
  value: V
  label: ReactNode
  disabled?: boolean
  title?: string
}

export interface SegmentedProps<V extends string = string> {
  options: SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  className?: string
  style?: CSSProperties
}

/**
 * Tiny segmented control (Day / Week / Month). Matches the design bundle's
 * Segmented primitive.
 */
export function Segmented<V extends string>({ options, value, onChange, className, style }: SegmentedProps<V>) {
  return (
    <div
      className={cn("inline-flex p-[3px] rounded-[10px] bg-[hsl(var(--surface-2))]", className)}
      style={style}
    >
      {options.map((o) => {
        const isActive = o.value === value
        const disabled = !!o.disabled
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            title={o.title}
            onClick={() => !disabled && onChange(o.value)}
            className={cn(
              "rounded-[7px] text-[11.5px] font-semibold px-[10px] py-[5px] transition-colors",
              disabled && "opacity-40 cursor-not-allowed",
              isActive
                ? "bg-card text-[hsl(var(--ink))] shadow-sm-stadium"
                : "bg-transparent text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))]",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default Segmented
