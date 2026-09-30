import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { refundBooking, type Booking } from "@/api/bookings"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { ChoiceButtons } from "./ChoiceButtons"
import { refreshBookingViews } from "./refreshBookingViews"

/**
 * Money going back. The ledger is append-only, so this records a new negative row rather
 * than editing the old one: the day's report shows the payment and the refund both, which
 * is what actually happened at the counter.
 *
 * The amount starts at what is most likely meant: everything, on a cancelled booking; the
 * overpayment, after a price was lowered; otherwise blank.
 */
export function RefundDialog({
  booking, onClose, onSaved,
}: { booking: Booking | null; onClose: () => void; onSaved?: () => void }) {
  return booking ? <RefundBody booking={booking} onClose={onClose} onSaved={onSaved} /> : null
}

function RefundBody({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved?: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const paid = booking.amountPaid ?? 0
  const overpaid = Math.max(0, paid - (booking.totalAmount ?? booking.amount))
  const suggested = booking.status === "cancelled" ? paid : overpaid
  const [amount, setAmount] = useState(suggested > 0 ? String(Math.round(suggested * 1000) / 1000) : "")
  const [kind, setKind] = useState<"refund" | "correction">("refund")
  const [note, setNote] = useState("")

  const value = Number(amount)
  const tooMuch = value > paid + 0.0005
  const valid = amount !== "" && value > 0 && !tooMuch

  const save = useMutation({
    mutationFn: () => refundBooking(booking.id, { amount: value, kind, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success(t("refund_recorded"))
      refreshBookingViews(qc)
      onClose()
      onSaved?.()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("refund_title")}</DialogTitle>
          <DialogDescription>
            {t("refund_paid_so_far").replace("{amount}", formatCurrency(paid))}
            {overpaid > 0.0005 && <> · {t("refund_overpaid_hint").replace("{amount}", formatCurrency(overpaid))}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ChoiceButtons
            value={kind}
            onChange={setKind}
            options={[
              { value: "refund", label: t("refund_kind_refund") },
              { value: "correction", label: t("refund_kind_correction") },
            ]}
          />
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">{t("amount")}</Label>
            <Input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min={0}
              max={paid}
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="num"
              autoFocus
            />
            {tooMuch && <p className="text-xs text-destructive">{t("refund_too_much")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-note">{t("refund_note")}</Label>
            <Input id="refund-note" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>{t("cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
            {t("refund_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
