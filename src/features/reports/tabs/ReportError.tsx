import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"

/** A failed load must never look like an empty report — that reads as "no business". */
export function ReportError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT()
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
      {t("report_load_failed")}
      <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>
    </div>
  )
}
