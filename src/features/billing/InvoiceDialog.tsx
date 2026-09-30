import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Printer, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  addInvoiceLine, getInvoice, issueInvoice, payInvoice, removeInvoiceLine, voidInvoice, type PayMethod,
} from "@/api/billing"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { lineText, periodLabel } from "@/lib/billing"
import { formatCurrency } from "@/lib/formatters"
import { InvoiceBadge } from "./InvoiceBadge"

type Pane = "view" | "pay" | "void" | "adjust"
const METHODS: PayMethod[] = ["cliq", "bank_transfer", "cash"]
const selectClass =
  "h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * One invoice. The owner reads it and prints it; the admin also adjusts a draft, issues it,
 * records the payment or voids it. Every action answers with the invoice as it now is.
 */
export function InvoiceDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  return invoiceId ? <InvoiceBody invoiceId={invoiceId} onClose={onClose} /> : null
}

function InvoiceBody({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const { t, lang } = useT()
  const { isAdmin } = useRole()
  const qc = useQueryClient()
  const { data: inv, isLoading } = useQuery({ queryKey: ["invoice", invoiceId], queryFn: () => getInvoice(invoiceId) })
  const [pane, setPane] = useState<Pane>("view")
  const [method, setMethod] = useState<PayMethod>("cliq")
  const [reference, setReference] = useState("")
  const [reason, setReason] = useState("")
  const [adjDesc, setAdjDesc] = useState("")
  const [adjAmount, setAdjAmount] = useState("")

  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] })
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["companies"] })
      setPane("view")
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })
  const run = (fn: () => Promise<unknown>, done: TranslationKey) =>
    act.mutate(fn, { onSuccess: () => toast.success(t(done)) })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {isLoading || !inv ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {inv.number ?? t("invoice_draft_title")}
                <InvoiceBadge invoice={inv} />
              </DialogTitle>
              <DialogDescription>
                {(lang === "ar" && inv.companyNameAr) || inv.companyName} · {periodLabel(inv.period, lang)}
                {inv.dueOn && inv.status === "issued" && <> · {t("invoice_due").replace("{date}", inv.dueOn)}</>}
              </DialogDescription>
            </DialogHeader>

            <table className="w-full text-sm">
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 pe-2">{lineText(l, lang)}</td>
                    <td className="num py-2 text-end">{formatCurrency(l.amount)}</td>
                    {isAdmin && inv.status === "draft" && (
                      <td className="w-8 py-2 text-end">
                        <button
                          type="button"
                          aria-label={t("invoice_remove_line")}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => run(() => removeInvoiceLine(inv.id, l.id), "invoice_updated")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="pt-3">{t("receipt_total")}</td>
                  <td className="num pt-3 text-end">{formatCurrency(inv.total)}</td>
                </tr>
              </tbody>
            </table>

            {inv.status === "paid" && (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-[hsl(var(--ink-2))]">
                {t("invoice_paid_by").replace("{method}", t(`pay_method_${inv.paidMethod}` as TranslationKey))}
                {inv.paidReference && ` · ${inv.paidReference}`}
              </p>
            )}
            {inv.status === "void" && inv.voidReason && (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-[hsl(var(--ink-2))]">{inv.voidReason}</p>
            )}

            {pane === "adjust" && (
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-desc">{t("invoice_line_description")}</Label>
                  <Input id="adj-desc" value={adjDesc} maxLength={255} onChange={(e) => setAdjDesc(e.target.value)} placeholder={t("invoice_line_placeholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adj-amount">{t("amount")}</Label>
                  <Input id="adj-amount" type="number" step="0.5" className="num" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">{t("invoice_line_hint")}</p>
              </div>
            )}
            {pane === "pay" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-method">{t("payment_method")}</Label>
                  <select id="pay-method" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                    {METHODS.map((m) => <option key={m} value={m}>{t(`pay_method_${m}` as TranslationKey)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-ref">{t("invoice_reference")}</Label>
                  <Input id="pay-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
                </div>
              </div>
            )}
            {pane === "void" && (
              <div className="space-y-1.5">
                <Label htmlFor="void-reason">{t("block_reason")}</Label>
                <Input id="void-reason" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} />
              </div>
            )}

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              {inv.status !== "draft" ? (
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={() => window.open(`/invoices/${inv.id}/print`, "_blank", "noopener")}
                >
                  <Printer className="h-3.5 w-3.5" />
                  {t("receipt_print")}
                </Button>
              ) : <span />}

              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  {pane === "view" && inv.status === "draft" && (
                    <>
                      <Button variant="outline" onClick={() => setPane("adjust")}>{t("invoice_add_line")}</Button>
                      <Button variant="outline" onClick={() => setPane("void")}>{t("invoice_void")}</Button>
                      <Button disabled={act.isPending} onClick={() => run(() => issueInvoice(inv.id), "invoice_issued_toast")}>
                        {t("invoice_issue")}
                      </Button>
                    </>
                  )}
                  {pane === "view" && inv.status === "issued" && (
                    <>
                      <Button variant="outline" onClick={() => setPane("void")}>{t("invoice_void")}</Button>
                      <Button onClick={() => setPane("pay")}>{t("invoice_mark_paid")}</Button>
                    </>
                  )}
                  {pane !== "view" && (
                    <>
                      <Button variant="ghost" onClick={() => setPane("view")} disabled={act.isPending}>{t("cancel")}</Button>
                      <Button
                        variant={pane === "void" ? "destructive" : "default"}
                        disabled={act.isPending || (pane === "adjust" && (!adjDesc.trim() || !Number(adjAmount)))}
                        onClick={() => {
                          if (pane === "pay") run(() => payInvoice(inv.id, { method, reference: reference.trim() || undefined }), "invoice_paid_toast")
                          if (pane === "void") run(() => voidInvoice(inv.id, reason.trim() || undefined), "invoice_voided_toast")
                          if (pane === "adjust") run(() => addInvoiceLine(inv.id, { description: adjDesc.trim(), amount: Number(adjAmount) }), "invoice_updated")
                        }}
                      >
                        {act.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
                        {pane === "pay" ? t("invoice_mark_paid") : pane === "void" ? t("invoice_void") : t("invoice_add_line")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
