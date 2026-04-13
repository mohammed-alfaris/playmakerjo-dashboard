import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, X, Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { getBooking, reviewProof } from "@/api/bookings"
import { formatCurrency, formatDate } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"

interface Props {
  bookingId: string | null
  open: boolean
  onClose: () => void
}

export function ProofReviewDialog({ bookingId, open, onClose }: Props) {
  const { t } = useT()
  const qc = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => getBooking(bookingId!),
    enabled: !!bookingId && open,
  })

  const review = useMutation({
    mutationFn: (payload: { approved: boolean; note?: string }) =>
      reviewProof(bookingId!, payload),
    onSuccess: (_, vars) => {
      toast.success(vars.approved ? t("proof_approved") : t("proof_rejected"))
      qc.invalidateQueries({ queryKey: ["bookings"] })
      qc.invalidateQueries({ queryKey: ["booking", bookingId] })
      handleClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? "Failed")
    },
  })

  function handleClose() {
    setRejecting(false)
    setNote("")
    onClose()
  }

  function handleApprove() {
    review.mutate({ approved: true })
  }

  function handleReject() {
    if (!note.trim()) {
      toast.error(t("rejection_reason_required"))
      return
    }
    review.mutate({ approved: false, note: note.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("review_proof")}</DialogTitle>
        </DialogHeader>

        {isLoading || !booking ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Booking summary */}
            <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">{t("venue")}</div>
                <div className="font-medium">{booking.venue.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t("player")}</div>
                <div className="font-medium">{booking.player.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t("sport")}</div>
                <div className="font-medium capitalize">{booking.sport}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t("date_time")}</div>
                <div className="font-medium">
                  {formatDate(booking.date)} {booking.startTime ? `· ${booking.startTime}` : ""}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Deposit</div>
                <div className="font-medium">
                  {formatCurrency(booking.depositAmount ?? booking.amount)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{t("status")}</div>
                <StatusBadge status={booking.status} />
              </div>
            </div>

            {/* Proof image */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">{t("review_proof")}</div>
              {booking.paymentProof && booking.paymentProof !== "(uploaded)" ? (
                <a
                  href={booking.paymentProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border bg-black"
                >
                  <img
                    src={booking.paymentProof}
                    alt="Payment proof"
                    className="w-full max-h-[400px] object-contain mx-auto"
                  />
                </a>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {t("no_proof_uploaded")}
                </div>
              )}
            </div>

            {/* Reject note */}
            {rejecting && (
              <div>
                <label className="text-xs text-muted-foreground">{t("rejection_reason")}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={t("rejection_reason")}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {booking && booking.paymentProofStatus === "pending_review" && !isLoading && (
            <>
              {!rejecting ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setRejecting(true)}
                    disabled={review.isPending}
                  >
                    <X className="h-4 w-4 me-1" /> {t("reject")}
                  </Button>
                  <Button onClick={handleApprove} disabled={review.isPending}>
                    {review.isPending ? (
                      <Loader2 className="h-4 w-4 me-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 me-1" />
                    )}
                    {t("approve")}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => { setRejecting(false); setNote("") }}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={review.isPending}
                  >
                    {review.isPending ? (
                      <Loader2 className="h-4 w-4 me-1 animate-spin" />
                    ) : null}
                    {t("reject")}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
