import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Check,
  X,
  Loader2,
  Image as ImageIcon,
  Download,
  AlertTriangle,
} from "lucide-react"
import { getBooking, reviewProof } from "@/api/bookings"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"

interface Props {
  bookingId: string | null
  open: boolean
  onClose: () => void
}

/**
 * Proof Review — Stadium Control Room design.
 * Custom modal (not shadcn Dialog) to match the split dark/light layout
 * and backdrop blur from the design bundle.
 */
export function ProofReviewDialog({ bookingId, open, onClose }: Props) {
  const { t, lang } = useT()
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

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const hasProofImage =
    !!booking?.paymentProof && booking.paymentProof !== "(uploaded)"

  const isPending = booking?.paymentProofStatus === "pending_review"

  const locale = lang === "ar" ? "ar-JO" : "en-GB"
  const submittedLabel = booking
    ? new Date(booking.date).toLocaleString(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  // The CliQ transfer happens out of band — the platform never observes the
  // amount actually sent. `amountPaid` is only written when this dialog approves
  // the proof, so before that it is always 0. There is no data to compare, and a
  // synthesised "match" signal would be a lie either way: the reviewer has to
  // read the amount off the screenshot.
  const expected = booking?.depositAmount ?? booking?.amount ?? 0

  const bookingShortId = booking?.id?.slice(0, 8)?.toUpperCase() ?? ""

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(11,20,16,0.65)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("review_proof")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(880px,92vw)] max-h-[88vh] overflow-hidden rounded-2xl bg-card shadow-stadium grid"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)" }}
      >
        {isLoading || !booking ? (
          <div className="col-span-2 flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
          </div>
        ) : (
          <>
            {/* LEFT — dark receipt panel */}
            <div className="relative flex min-h-[480px] flex-col items-center justify-center bg-ink p-6">
              {/* Top bar — filename */}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4 text-[11px]">
                {/* Only name a file when one actually exists — this used to print
                    "CLIQ-PROOF-{id}.jpg" even for bookings with no upload at all. */}
                <div
                  className="mono flex items-center gap-2 text-[#b7c2bc]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {hasProofImage && (
                    <>
                      <ImageIcon className="h-3 w-3" />
                      CLIQ-PROOF-{bookingShortId}.jpg
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {hasProofImage && (
                    <a
                      href={booking.paymentProof!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded p-1.5 text-[#b7c2bc] transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded p-1.5 text-[#b7c2bc] transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* The uploaded proof, or an honest empty state.
                  This used to render a synthetic "CliQ TRANSFER RECEIPT" — a
                  green tick, an amount, a reference and a bank name — whenever
                  no image existed. That is a forged document: the owner saw what
                  looked like a verified transfer for a booking with no proof at
                  all. Never render anything that resembles evidence we do not
                  have. */}
              {hasProofImage ? (
                <img
                  src={booking.paymentProof!}
                  alt="Payment proof"
                  className="mt-8 max-h-[400px] w-auto rounded-lg border border-white/10 object-contain shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              ) : (
                <div className="mt-8 flex w-[260px] flex-col items-center gap-3 rounded-lg border border-dashed border-white/20 p-8 text-center">
                  <ImageIcon className="h-8 w-8 text-white/30" />
                  <div className="text-[13px] font-medium text-white/70">
                    {t("no_proof_uploaded")}
                  </div>
                </div>
              )}

              {/* A three-thumbnail strip used to render here unconditionally as a
                  "design motif". A booking carries at most ONE paymentProof, so it
                  implied two uploads that never existed — decorative fiction on the
                  screen where someone decides whether money arrived. */}
            </div>

            {/* RIGHT — details + decision */}
            <div className="flex flex-col overflow-hidden p-6 pb-5">
              <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber">
                <AlertTriangle className="h-3 w-3" />
                {t("proof_review")}
              </div>
              <h2 className="display text-[20px] font-semibold text-ink">
                {bookingShortId}
              </h2>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {t("submitted_on")} {submittedLabel} · {booking.player.name}
              </p>

              <div className="hair my-4" />

              <div className="flex-1 space-y-3.5 overflow-y-auto">
                <Row
                  label={t("amount_expected")}
                  value={formatCurrency(expected)}
                  mono
                />
                <Row
                  label={t("cliq_alias")}
                  value={booking.venue.cliqAlias || "—"}
                  mono
                />
                <Row
                  label={t("booking_reference")}
                  value={bookingShortId || "—"}
                  mono
                />
                <Row label={t("venue")} value={booking.venue.name} />
                <Row
                  label={t("date_of_match")}
                  value={new Date(booking.date).toLocaleDateString(locale, {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })}
                />
              </div>

              {/* The platform cannot verify the transfer — the reviewer must. */}
              {isPending && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/50 p-3 text-[12px] text-ink">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-ink" />
                  <div>
                    <div className="mb-0.5 font-semibold">
                      {t("verify_before_approving")}
                    </div>
                    <div className="text-ink-3">{t("verify_amount_hint")}</div>
                  </div>
                </div>
              )}

              {!isPending && booking.paymentProofNote && (
                <div
                  className={cn(
                    "mt-4 rounded-xl p-3 text-[12px]",
                    booking.paymentProofStatus === "approved"
                      ? "bg-brand-tint text-brand-ink"
                      : "bg-rose-tint text-rose-ink"
                  )}
                >
                  <div className="font-semibold">
                    {booking.paymentProofStatus === "approved"
                      ? t("already_approved")
                      : t("already_rejected")}
                  </div>
                  <div className="opacity-80">{booking.paymentProofNote}</div>
                </div>
              )}

              {/* Reject reason field */}
              {rejecting && isPending && (
                <div className="mt-4">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    {t("rejection_reason")}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder={t("rejection_reason") ?? ""}
                    className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Actions */}
              {isPending && (
                <div className="mt-3.5 flex gap-2">
                  {!rejecting ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejecting(true)}
                        disabled={review.isPending}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose/50 bg-card text-[12px] font-semibold text-rose transition-colors hover:bg-rose-tint disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                        {t("reject_proof")}
                      </button>
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={review.isPending}
                        className="flex h-9 flex-[2] items-center justify-center gap-1.5 rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {review.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {t("approve_payment")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(false)
                          setNote("")
                        }}
                        disabled={review.isPending}
                        className="h-9 flex-1 rounded-lg text-[12px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={review.isPending}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose text-[12px] font-semibold text-white transition-colors hover:bg-rose/90 disabled:opacity-50"
                      >
                        {review.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {t("confirm_reject")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- sub-components ---------------------------------------------------------

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-3">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn("text-[14px] font-semibold text-ink", mono && "mono num")}
        >
          {value}
        </span>
      </div>
    </div>
  )
}
