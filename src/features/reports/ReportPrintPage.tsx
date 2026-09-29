import { useEffect, useRef } from "react"
import { useIsFetching, useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Printer } from "lucide-react"
import { getCompany } from "@/api/companies"
import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { useAuthStore } from "@/store/authStore"
import { writeFilters } from "./reportLogic"
import { useReportFilters } from "./useReportFilters"
import { useVisibleTabs } from "./useVisibleTabs"
import BookingsTab from "./tabs/BookingsTab"
import BusyHoursTab from "./tabs/BusyHoursTab"
import CustomersTab from "./tabs/CustomersTab"
import MoneyTab from "./tabs/MoneyTab"
import PlatformTab from "./tabs/PlatformTab"

/**
 * The PDF. Every section the viewer may see, laid out for A4, then the browser's print dialog
 * — where "Save as PDF" lives. Printing the real page rather than generating a PDF on the
 * server keeps Arabic shaping and right-to-left layout exactly as on screen, and means the
 * PDF uses the same components as the page, so it cannot show different numbers.
 */
export default function ReportPrintPage() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { isAdmin } = useRole()
  const { filters, params } = useReportFilters()
  const tabs = useVisibleTabs(filters.company)
  const companyName = useAuthStore((s) => s.user?.access?.companyName)

  const { data: company } = useQuery({
    queryKey: ["company", filters.company],
    queryFn: () => getCompany(filters.company),
    enabled: isAdmin && !!filters.company,
  })
  const title = isAdmin
    ? (filters.company ? company?.data.name : t("report_platform_title"))
    : companyName

  // Paper is white: take the page out of dark mode while it is open.
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.remove("dark")
    return () => { if (wasDark) root.classList.add("dark") }
  }, [])

  // Print once every report has arrived and the charts have had a frame to lay out.
  const fetching = useIsFetching({ queryKey: ["report"] })
  const printed = useRef(false)
  useEffect(() => {
    if (fetching > 0 || printed.current) return
    const timer = window.setTimeout(() => {
      printed.current = true
      window.print()
    }, 600)
    return () => window.clearTimeout(timer)
  }, [fetching])

  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  const period = `${fmt.format(new Date(`${filters.from}T00:00:00Z`))} – ${fmt.format(new Date(`${filters.to}T00:00:00Z`))}`

  return (
    <div className="report-print mx-auto max-w-[1000px] bg-background p-6 text-foreground">
      <div className="no-print mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5"
          onClick={() => navigate(`/reports?${writeFilters(filters).toString()}`)}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("report_back")}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t("report_print")}
        </Button>
      </div>

      <header className="mb-6 border-b pb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--ink-3))]">PlayMaker · {t("reports")}</div>
        <h1 className="mt-1 text-2xl font-semibold">{title ?? "—"}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--ink-2))]">
          {period}
          {filters.compare && ` · ${t("report_compare")}`}
        </p>
        <p className="mt-0.5 text-xs text-[hsl(var(--ink-3))]">
          {t("report_generated")} {new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Amman" }).format(new Date())}
        </p>
      </header>

      {tabs.map((tab, i) => (
        <section key={tab} className={i > 0 ? "print-break mt-10" : ""}>
          <h2 className="mb-4 text-lg font-semibold">{t(`report_tab_${tab}` as TranslationKey)}</h2>
          {tab === "platform" && <PlatformTab params={params} print />}
          {tab === "money" && <MoneyTab params={params} print />}
          {tab === "busy" && <BusyHoursTab params={params} print />}
          {tab === "bookings" && <BookingsTab params={params} print />}
          {tab === "customers" && <CustomersTab params={params} print />}
        </section>
      ))}
    </div>
  )
}
