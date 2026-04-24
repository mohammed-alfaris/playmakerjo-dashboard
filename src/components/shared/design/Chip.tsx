import type { ReactNode, CSSProperties } from "react"
import { colorFor, type ColorName } from "@/lib/timelineDesign"
import { cn } from "@/lib/utils"

export interface ChipProps {
  color?: ColorName | string
  children?: ReactNode
  dot?: boolean
  size?: "sm" | "md"
  className?: string
  style?: CSSProperties
  onClick?: () => void
  title?: string
}

/**
 * Tinted status pill — `color` drives both the dot and the background tint.
 * Solid fill uses `colorFor(color).tint`, text uses `.ink`. Matches the
 * design bundle's Chip primitive.
 */
export function Chip({ color = "slate", children, dot, size = "md", className, style, onClick, title }: ChipProps) {
  const c = colorFor(color)
  const sizeStyle: CSSProperties = size === "sm"
    ? { height: 20, padding: "0 7px", fontSize: 10.5 }
    : { height: 24, padding: "0 9px", fontSize: 11 }

  return (
    <span
      className={cn("inline-flex items-center gap-[5px] rounded-full font-semibold tracking-[0.01em] whitespace-nowrap leading-none", className)}
      style={{ background: c.tint, color: c.ink, ...sizeStyle, ...style }}
      onClick={onClick}
      title={title}
    >
      {dot && (
        <span
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, background: c.bg }}
        />
      )}
      {children}
    </span>
  )
}

export default Chip
