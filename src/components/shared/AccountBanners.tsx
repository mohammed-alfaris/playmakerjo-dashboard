import { Link } from "react-router-dom"
import { AlertTriangle, Eye, X } from "lucide-react"
import { useMyCompany } from "@/hooks/useMyCompany"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { useViewAsStore } from "@/store/viewAsStore"

/**
 * The two strips that sit above every page when they apply:
 *  - an owner with an overdue PlayMaker invoice — the only thing that happens when one is
 *    unpaid (the admin suspends by hand if it comes to that);
 *  - an admin viewing the dashboard as a company, with the way back.
 */
export function AccountBanners() {
  const { t } = useT()
  const { isAdmin } = useRole()
  const company = useMyCompany()
  const viewAs = useViewAsStore()
  const overdue = company?.billing?.overdueCount ?? 0

  return (
    <>
      {overdue > 0 && (
        <div className="flex items-center gap-2 border-b border-[hsl(var(--rose)/0.3)] bg-[hsl(var(--rose)/0.08)] px-6 py-2 text-sm text-[hsl(var(--rose-ink))]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {t("billing_overdue_banner")
              .replace("{count}", String(overdue))
              .replace("{amount}", formatCurrency(company!.billing.overdueAmount))}
          </span>
          <Link to="/billing" className="font-semibold underline underline-offset-2">{t("billing_view_invoices")}</Link>
        </div>
      )}
      {isAdmin && viewAs.companyId && (
        <div className="flex items-center gap-2 border-b border-[hsl(var(--indigo)/0.3)] bg-[hsl(var(--indigo)/0.08)] px-6 py-2 text-sm text-[hsl(var(--indigo))]">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("view_as_banner").replace("{name}", viewAs.companyName ?? "")}</span>
          <button type="button" onClick={viewAs.exit} className="inline-flex items-center gap-1 font-semibold">
            <X className="h-3.5 w-3.5" />
            {t("view_as_exit")}
          </button>
        </div>
      )}
    </>
  )
}
