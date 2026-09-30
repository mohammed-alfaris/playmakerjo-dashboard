import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cancelBooking, type Booking, type RefundChoice } from "@/api/bookings"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { cancelPreview, refundFor } from "@/lib/cancellation"
import { formatCurrency } from "@/lib/formatters"
import { ChoiceButtons } from "./ChoiceButtons"
import { refreshBookingViews } from "./refreshBookingViews"

/**
 * Cancelling says what happens to the money before anyone presses the button. The venue's
 * free-cancellation window decides by default; whoever may record payments can overrule it
 * either way ("refund anyway" / "keep it"). Without that permission the booking is cancelled
 * and the money stays recorded for the owner — the server enforces the same.
 */
export function CancelBookingDialog({
  booking,
  onClose,
  onCancelled,
}: {
  booking: Booking | null
  onClose: () => void
  onCancelled?: () => void
}) {
  return booking ? <CancelBody booking={booking} onClose={onClose} onCancelled={onCancelled} /> : null
}

function CancelBody({ booking, onClose, onCancelled }: { booking: Booking; onClose: () => void; onCancelled?: () => void }) {
  const { t } = useT()
  const { can } = useRole()
  const qc = useQueryClient()
  // Measured once, when the dialog opens: the preview must not flip while someone reads it.
  const [openedAt] = useState(() => Date.now())
  const preview = cancelPreview(booking, openedAt)
  const mayRefund = can("payments.record")
  const [choice, setChoice] = useState<RefundChoice>("policy")
  const refund = mayRefund ? refundFor(preview, choice) : 0
  const paid = formatCurrency(preview.paid)
  const hours = String(preview.freeCancelHours)

  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking.id, mayRefund ? choice : "policy"),
    onSuccess: () => {
      toast.success(refund > 0
        ? t("cancel_refunded_toast").replace("{amount}", formatCurrency(refund))
        : t("booking_cancelled_toast"))
      refreshBookingViews(qc)
      onCancelled?.()
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  // The rule's outcome first, then the one alternative: refunding when the rule keeps,
  // keeping when the rule refunds.
  const ruleRefunds = preview.free
  const options: { value: RefundChoice; label: React.ReactNode }[] = [
    {
      value: "policy",
      label: (
        <span>
          {(ruleRefunds ? t("cancel_opt_refund") : t("cancel_opt_keep")).replace("{amount}", paid)}
          <span className="ms-1 text-[hsl(var(--ink-3))]">· {t("cancel_opt_rule")}</span>
        </span>
      ),
    },
    {
      value: ruleRefunds ? "none" : "all",
      label: (ruleRefunds ? t("cancel_opt_keep") : t("cancel_opt_refund")).replace("{amount}", paid),
    },
  ]

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("cancel_booking_title")}</DialogTitle>
          <DialogDescription>
            {preview.paid <= 0
              ? t("cancel_nothing_paid")
              : (ruleRefunds ? t("cancel_rule_refunds") : t("cancel_rule_keeps"))
                  .replace("{hours}", hours)
                  .replace("{amount}", paid)}
          </DialogDescription>
        </DialogHeader>

        {preview.paid > 0 && (mayRefund ? (
          <ChoiceButtons value={choice} onChange={setChoice} options={options} />
        ) : (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-[hsl(var(--ink-2))]">
            {t("cancel_money_stays").replace("{amount}", paid)}
          </p>
        ))}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            {t("cancel_keep_booking")}
          </Button>
          <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
            {t("cancel_confirm_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
