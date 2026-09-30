import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { getInvoice } from "@/api/billing"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"
import { lineText, periodLabel } from "@/lib/billing"
import { formatCurrency } from "@/lib/formatters"
import { InvoiceBadge } from "./InvoiceBadge"

/**
 * PlayMaker's invoice to a company, for paper or "Save as PDF" — printed from the browser like
 * the reports and receipts, so Arabic prints exactly as it reads on screen.
 */
export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { data: inv, isLoading, isError } = useQuery({ queryKey: ["invoice", id], queryFn: () => getInvoice(id!), enabled: !!id })

  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.remove("dark")
    return () => { if (wasDark) root.classList.add("dark") }
  }, [])

  const printed = useRef(false)
  useEffect(() => {
    if (!inv || printed.current) return
    const timer = window.setTimeout(() => { printed.current = true; window.print() }, 300)
    return () => window.clearTimeout(timer)
  }, [inv])

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (isError || !inv) return <div className="p-8 text-center text-sm text-muted-foreground">{t("invoice_not_found")}</div>

  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Amman" })

  return (
    <div className="report-print mx-auto max-w-[800px] bg-background p-8 text-foreground">
      <div className="no-print mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("receipt_back")}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t("receipt_print")}
        </Button>
      </div>

      <header className="mb-8 flex items-start justify-between border-b pb-5">
        <div>
          <p className="text-2xl font-bold">PlayMaker JO</p>
          <p className="text-xs text-muted-foreground">playmakerjo.com</p>
        </div>
        <div className="text-end">
          <p className="flex items-center justify-end gap-2 text-lg font-bold">
            {t("invoice_title")} <InvoiceBadge invoice={inv} />
          </p>
          <p className="num text-sm">{inv.number}</p>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("invoice_billed_to")}</p>
          <p className="font-semibold">{(lang === "ar" && inv.companyNameAr) || inv.companyName}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-end">
          <dt className="text-muted-foreground">{t("billing_month")}</dt><dd>{periodLabel(inv.period, lang)}</dd>
          {inv.issuedAt && (<><dt className="text-muted-foreground">{t("receipt_issued")}</dt><dd>{date.format(new Date(inv.issuedAt))}</dd></>)}
          {inv.dueOn && (<><dt className="text-muted-foreground">{t("invoice_due_col")}</dt><dd className="num">{inv.dueOn}</dd></>)}
        </dl>
      </div>

      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-y text-xs text-muted-foreground">
            <th className="py-2 text-start font-medium">{t("invoice_line_description")}</th>
            <th className="py-2 text-end font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2">{lineText(l, lang)}</td>
              <td className="num py-2 text-end">{formatCurrency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ms-auto w-64 border-t pt-2 text-base font-bold">
        <div className="flex justify-between"><span>{t("receipt_total")}</span><span className="num">{formatCurrency(inv.total)}</span></div>
      </div>

      <footer className="mt-12 border-t pt-4 text-xs text-muted-foreground">
        {inv.status === "paid" ? <p>{t("invoice_thanks_paid")}</p> : <p>{t("billing_how_to_pay")}</p>}
      </footer>
    </div>
  )
}
