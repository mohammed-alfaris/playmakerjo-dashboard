import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"

const STATUS_STYLES: Record<string, string> = {
  // green
  active:    "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
  confirmed: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
  paid:      "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
  // amber
  pending:         "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
  pending_payment: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
  pending_review:  "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
  approved:        "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
  rejected:        "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
  // red
  cancelled: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
  banned:    "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
  failed:    "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
  inactive:  "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
  // purple
  refunded:  "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100",
  // blue
  completed: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100",
}

const STATUS_KEYS: Record<string, TranslationKey> = {
  active:    "status_active",
  inactive:  "status_inactive",
  pending:   "status_pending",
  confirmed: "status_confirmed",
  cancelled: "status_cancelled",
  completed: "status_completed",
  banned:    "status_banned",
  paid:      "status_paid",
  failed:    "status_failed",
  refunded:  "status_refunded",
  pending_review: "pending_review",
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useT()
  const styles = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"
  const key = STATUS_KEYS[status]
  const label = key ? t(key) : status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", styles, className)}
    >
      {label}
    </Badge>
  )
}
