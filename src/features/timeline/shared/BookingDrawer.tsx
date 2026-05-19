import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import api from "@/api/axios"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { Booking } from "@/api/bookings"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { parseHHMM, fmtRange } from "@/lib/timelineDesign"

// ---------------------------------------------------------------------------
// BookingDrawer — right side sheet for a selected booking
// ---------------------------------------------------------------------------

export interface BookingDrawerProps {
  booking: Booking
  onClose: () => void
  onView: () => void
  onCompleted?: () => void
}

export function BookingDrawer({ booking, onClose, onView, onCompleted }: BookingDrawerProps) {
  const { t } = useT()
  const qc = useQueryClient()
  const startMin = parseHHMM(booking.startTime)
  const endMin = startMin + (booking.duration ?? 0)

  const complete = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/complete`),
    onSuccess: () => {
      toast.success(t("mark_completed"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onCompleted?.()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  const cancel = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/cancel`),
    onSuccess: () => {
      toast.success(t("status_cancelled"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle className="display tracking-[-0.02em]">
            {booking.player?.name ?? "—"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={booking.status} />
            <span className="mono text-[11.5px] text-[hsl(var(--ink-3))]">
              {fmtRange(startMin, endMin)}
            </span>
          </div>
          <div className="hair" />
          <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
            <InfoCell label={t("sport")} value={<span className="capitalize">{booking.sport}</span>} />
            <InfoCell label={t("duration")} value={`${booking.duration} min`} />
            <InfoCell label={t("amount")} value={formatCurrency(booking.totalAmount ?? booking.amount)} />
            {booking.paymentMethod && (
              <InfoCell label={t("payment_method")} value={<span className="uppercase">{booking.paymentMethod}</span>} />
            )}
            {booking.pitchSize && (
              <InfoCell label={t("pitch_size") ?? "Size"} value={`${booking.pitchSize}-aside`} />
            )}
          </dl>
          <div className="hair" />
          <div className="space-y-2">
            <Button size="sm" variant="outline" className="w-full" onClick={onView}>
              {t("view_drawer")}
            </Button>
            {booking.status === "confirmed" && (
              <Button
                size="sm"
                className="w-full gap-1"
                onClick={() => complete.mutate()}
                disabled={complete.isPending}
              >
                {complete.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("mark_completed")}
              </Button>
            )}
            {["pending", "pending_payment", "pending_review", "confirmed"].includes(
              booking.status,
            ) && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-[hsl(var(--rose-ink))] gap-1"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("cancel")}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
        {label}
      </dt>
      <dd className="font-medium text-[hsl(var(--ink))] mt-0.5">{value}</dd>
    </div>
  )
}
