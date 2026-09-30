import { Link } from "react-router-dom"
import { Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"

/**
 * Shown instead of a page when PlayMaker has suspended the company. The server has already
 * closed the back office; without this, every screen would just load empty and look broken.
 * The owner is pointed at billing, which stays open.
 */
export function SuspendedNotice() {
  const { t } = useT()
  const { isOwner } = useRole()
  return (
    <div className="mx-auto mt-16 max-w-md rounded-[16px] border bg-card p-8 text-center shadow-sm-stadium">
      <Ban className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--rose-ink))]" />
      <h1 className="mb-2 text-lg font-bold">{t("suspended_title")}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{isOwner ? t("suspended_owner_body") : t("suspended_staff_body")}</p>
      {isOwner && (
        <Button asChild>
          <Link to="/billing">{t("billing_view_invoices")}</Link>
        </Button>
      )}
    </div>
  )
}
