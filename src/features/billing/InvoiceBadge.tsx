import type { Invoice } from "@/api/billing"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { invoiceState } from "@/lib/billing"
import { cn } from "@/lib/utils"

const TONE: Record<ReturnType<typeof invoiceState>, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-[hsl(var(--indigo)/0.12)] text-[hsl(var(--indigo))]",
  overdue: "bg-[hsl(var(--rose)/0.14)] text-[hsl(var(--rose-ink))]",
  paid: "bg-[hsl(var(--brand)/0.14)] text-[hsl(var(--brand-ink))]",
  void: "bg-muted text-muted-foreground line-through",
}

export function InvoiceBadge({ invoice, className }: { invoice: Pick<Invoice, "status" | "overdue">; className?: string }) {
  const { t } = useT()
  const state = invoiceState(invoice)
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[state], className)}>
      {t(`invoice_state_${state}` as TranslationKey)}
    </span>
  )
}
