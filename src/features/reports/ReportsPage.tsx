import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { BarChart3, CalendarCheck, Clock, FileSpreadsheet, Loader2, Printer, Users, Wallet } from "lucide-react"
import { downloadReportExcel } from "@/api/reports"
import { PageHeader } from "@/components/shared/PageHeader"
import { Tabs } from "@/components/shared/design/Tabs"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { FilterBar } from "./FilterBar"
import { writeFilters, type ReportTab } from "./reportLogic"
import { useReportFilters } from "./useReportFilters"
import { useVisibleTabs } from "./useVisibleTabs"
import BookingsTab from "./tabs/BookingsTab"
import BusyHoursTab from "./tabs/BusyHoursTab"
import CustomersTab from "./tabs/CustomersTab"
import MoneyTab from "./tabs/MoneyTab"
import PlatformTab from "./tabs/PlatformTab"

const TAB_ICONS: Record<ReportTab, React.ElementType> = {
  platform: BarChart3, money: Wallet, busy: Clock, bookings: CalendarCheck, customers: Users,
}

export default function ReportsPage() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { filters, update, params, searchParams } = useReportFilters()
  const tabs = useVisibleTabs(filters.company)
  const tab = filters.tab && tabs.includes(filters.tab) ? filters.tab : tabs[0]
  const [exporting, setExporting] = useState(false)

  async function exportExcel() {
    setExporting(true)
    try {
      const blob = await downloadReportExcel(params, lang === "ar" ? "ar" : "en")
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `playmaker-report-${filters.from}-${filters.to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t("export_failed"))
    } finally {
      setExporting(false)
    }
  }

  // "Export report" in the command palette and the + button land here with ?export=1.
  const exportRequested = useRef(searchParams.get("export") === "1")
  useEffect(() => {
    if (!exportRequested.current) return
    exportRequested.current = false
    update({})
    void exportExcel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("reports")}
        subtitle={t("report_subtitle")}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel} disabled={exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              {t("report_excel")}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => navigate(`/reports/print?${writeFilters({ ...filters, tab }).toString()}`)}>
              <Printer className="h-3.5 w-3.5" />
              {t("report_print")}
            </Button>
          </div>
        }
      />

      <FilterBar filters={filters} update={update} />

      <Tabs<ReportTab>
        tabs={tabs.map((id) => {
          const Icon = TAB_ICONS[id]
          return { id, label: t(`report_tab_${id}` as TranslationKey), icon: <Icon className="h-3.5 w-3.5" /> }
        })}
        active={tab}
        onChange={(id) => update({ tab: id })}
      />

      {tab === "platform" && (
        <PlatformTab params={params} onOpenCompany={(ownerId) => update({ company: ownerId, venue: "", tab: "money" })} />
      )}
      {tab === "money" && <MoneyTab params={params} />}
      {tab === "busy" && <BusyHoursTab params={params} />}
      {tab === "bookings" && <BookingsTab params={params} />}
      {tab === "customers" && <CustomersTab params={params} />}
    </div>
  )
}
