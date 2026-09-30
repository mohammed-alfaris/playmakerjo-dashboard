import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Loader2, Printer } from "lucide-react"
import { getReceipt, type ReceiptLine } from "@/api/bookings"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { formatCurrency } from "@/lib/formatters"

/**
 * A receipt for the customer at the counter, sized for A5 and printed from the browser —
 * the same approach as the report PDF, so Arabic prints exactly as it reads on screen.
 * Every ledger row is listed, refunds included, so the paper agrees with the money report.
 */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { data: r, isLoading, isError } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => getReceipt(id!),
    enabled: !!id,
  })

  // Paper is white: take the page out of dark mode while it is open.
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains("dark")
    root.classList.remove("dark")
    return () => { if (wasDark) root.classList.add("dark") }
  }, [])

  const printed = useRef(false)
  useEffect(() => {
    if (!r || printed.current) return
    const timer = window.setTimeout(() => {
      printed.current = true
      window.print()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [r])

  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  const stamp = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Amman" })
  const kind = (k: ReceiptLine["kind"]) => (k ? t(`payment_kind_${k}` as TranslationKey) ?? k : "")

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }
  if (isError || !r) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{t("receipt_not_found")}</div>
  }

  const company = (lang === "ar" && r.companyNameAr) || r.companyName
  const venue = (lang === "ar" && r.venueNameAr) || r.venueName
  const endMin = r.startTime
    ? (() => { const [h, m] = r.startTime.split(":").map(Number); return h * 60 + m + r.duration })()
    : null
  const end = endMin == null ? null : `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`

  return (
    <div className="receipt-print mx-auto max-w-[560px] bg-background p-6 text-foreground">
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

      <header className="mb-5 border-b pb-4 text-center">
        {company && <p className="text-lg font-bold">{company}</p>}
        <p className="font-semibold">{venue}</p>
        {(r.venueAddress || r.venueCity) && (
          <p className="text-xs text-muted-foreground">{[r.venueAddress, r.venueCity].filter(Boolean).join(", ")}</p>
        )}
      </header>

      <div className="mb-4 flex items-baseline justify-between text-sm">
        <span className="text-base font-bold">
          {t("receipt_title")}
          {/* A receipt for a booking that did not go ahead says so, next to the title. */}
          {(r.status === "cancelled" || r.status === "no_show") && (
            <span className="ms-2 rounded border border-current px-1.5 py-0.5 text-xs font-semibold uppercase text-[hsl(var(--rose-ink))]">
              {t(r.status === "cancelled" ? "status_cancelled" : "status_no_show")}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("receipt_number")} <span className="num font-semibold text-foreground">{r.receiptNumber}</span>
        </span>
      </div>

      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {r.customerName && (<><dt className="text-muted-foreground">{t("receipt_customer")}</dt><dd>{r.customerName}{r.customerPhone && <span className="num ms-2 text-muted-foreground" dir="ltr">{r.customerPhone}</span>}</dd></>)}
        <dt className="text-muted-foreground">{t("receipt_booking")}</dt>
        <dd>
          {day.format(new Date(`${r.date}T00:00:00Z`))}
          {r.startTime && <span className="num ms-2" dir="ltr">{r.startTime.slice(0, 5)}{end && `–${end}`}</span>}
        </dd>
        <dt className="text-muted-foreground">{t("pitch")}</dt>
        <dd className="capitalize">
          {[r.pitchName, r.sport, r.pitchSize && `${r.pitchSize}-aside`].filter(Boolean).join(" · ")}
        </dd>
      </dl>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-y text-xs text-muted-foreground">
            <th className="py-1.5 text-start font-medium">{t("receipt_payments")}</th>
            <th className="py-1.5 text-end font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {r.payments.length === 0 && (
            <tr><td colSpan={2} className="py-2 text-muted-foreground">{t("receipt_no_payments")}</td></tr>
          )}
          {r.payments.map((p, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-1.5">
                <span className="num text-xs text-muted-foreground">{stamp.format(new Date(p.date))}</span>
                <span className="ms-2">{kind(p.kind)}</span>
                {p.method && <span className="ms-1 text-xs uppercase text-muted-foreground">· {p.method}</span>}
              </td>
              <td className="num py-1.5 text-end">{formatCurrency(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ms-auto w-60 space-y-1 text-sm">
        <div className="flex justify-between"><dt>{t("receipt_total")}</dt><dd className="num">{formatCurrency(r.totalAmount)}</dd></div>
        <div className="flex justify-between"><dt>{t("receipt_paid")}</dt><dd className="num">{formatCurrency(r.amountPaid)}</dd></div>
        <div className="flex justify-between border-t pt-1 font-bold"><dt>{t("receipt_balance")}</dt><dd className="num">{formatCurrency(r.balance)}</dd></div>
      </dl>

      <footer className="mt-8 border-t pt-3 text-center text-xs text-muted-foreground">
        <p>{t("receipt_thanks")}</p>
        <p className="mt-1">{t("receipt_issued")}: <span className="num">{stamp.format(new Date(r.issuedAt))}</span></p>
      </footer>
    </div>
  )
}
