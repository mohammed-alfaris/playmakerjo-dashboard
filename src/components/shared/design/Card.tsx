import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type Props = HTMLAttributes<HTMLDivElement>

/**
 * Stadium Card — used across the V1 redesign. Matches the design bundle's
 * Card primitive: white surface (dark-mode aware), hairline border, medium
 * rounding, `shadow-sm-stadium`.
 */
export function Card({ className, ...rest }: Props) {
  return (
    <div
      className={cn(
        "bg-card border border-[hsl(var(--line))] rounded-[14px] shadow-sm-stadium",
        className,
      )}
      {...rest}
    />
  )
}

export default Card
