import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateBooking, type Booking, type UpdateBookingPayload } from "@/api/bookings"
import { getVenue, type Venue } from "@/api/venues"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { refreshBookingViews } from "./refreshBookingViews"

const selectClass =
  "h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

function durationLabel(d: number) {
  const h = Math.floor(d / 60)
  const m = d % 60
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m}`
}

/**
 * Move a booking to another day, time, length, pitch or size, or change its price. The
 * server runs the same checks as a new booking (hours, size, clashes, blocked time) with this
 * booking left out of its own way, and its refusal is shown as it comes back — it names the
 * clash. Only fields that changed are sent.
 *
 * The price field shows only to someone who may record payments; left empty, a longer game
 * or another size is priced from the list, and a plain move keeps the price it had.
 */
export function MoveBookingDialog({
  booking, onClose, onSaved,
}: { booking: Booking | null; onClose: () => void; onSaved?: () => void }) {
  return booking ? <MoveBody booking={booking} onClose={onClose} onSaved={onSaved} /> : null
}

function MoveBody({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved?: () => void }) {
  const { t } = useT()
  const { can } = useRole()
  const qc = useQueryClient()
  const { data: venueData } = useQuery({
    queryKey: ["venue", booking.venue.id],
    queryFn: () => getVenue(booking.venue.id),
  })
  const venue: Venue | undefined = venueData?.data

  const [date, setDate] = useState(booking.date.slice(0, 10))
  const [startTime, setStartTime] = useState((booking.startTime ?? "").slice(0, 5))
  const [duration, setDuration] = useState(booking.duration)
  const [pitchId, setPitchId] = useState(booking.pitchId ?? "")
  const [pitchSize, setPitchSize] = useState(booking.pitchSize ?? "")
  const [price, setPrice] = useState("")

  const sportPitches = useMemo(
    () => (venue?.pitches ?? []).filter((p) => p.sport.toLowerCase() === booking.sport.toLowerCase()),
    [venue, booking.sport],
  )
  const pitch = sportPitches.find((p) => p.id === pitchId) ?? null
  const sizes = pitch?.parentSize ? [pitch.parentSize, ...(pitch.subSizes ?? [])] : []

  const durations = useMemo(() => {
    const min = venue?.minBookingDuration ?? 30
    const max = venue?.maxBookingDuration ?? 180
    const out = [30, 60, 90, 120, 150, 180, 240].filter((d) => d >= min && d <= max)
    if (!out.includes(booking.duration)) out.push(booking.duration)
    return out.sort((a, b) => a - b)
  }, [venue, booking.duration])

  const payload: UpdateBookingPayload = {}
  if (date !== booking.date.slice(0, 10)) payload.date = date
  if (startTime && startTime !== (booking.startTime ?? "").slice(0, 5)) payload.startTime = startTime
  if (duration !== booking.duration) payload.duration = duration
  if (pitchId && pitchId !== (booking.pitchId ?? "") && !pitchId.startsWith("legacy-")) payload.pitchId = pitchId
  if (pitchSize && pitchSize !== (booking.pitchSize ?? "") && sizes.includes(pitchSize)) payload.pitchSize = pitchSize
  if (price !== "" && can("payments.record")) payload.totalAmount = Number(price)
  const changed = Object.keys(payload).length > 0
  const priceInvalid = price !== "" && !(Number(price) >= 0)

  const save = useMutation({
    mutationFn: () => updateBooking(booking.id, payload),
    onSuccess: ({ booking: updated }) => {
      const overpaid = (updated.amountPaid ?? 0) - (updated.totalAmount ?? updated.amount)
      toast.success(overpaid > 0.0005
        ? t("move_overpaid").replace("{amount}", formatCurrency(overpaid))
        : t("move_saved"))
      refreshBookingViews(qc)
      onClose()
      onSaved?.()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("move_title")}</DialogTitle>
          {!booking.isManual && <DialogDescription>{t("move_player_notified")}</DialogDescription>}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="move-date">{t("date")}</Label>
            <Input id="move-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="num" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-time">{t("start_time")}</Label>
            <Input id="move-time" type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="num" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="move-duration">{t("duration")}</Label>
            <select id="move-duration" className={selectClass} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {durations.map((d) => <option key={d} value={d}>{durationLabel(d)}</option>)}
            </select>
          </div>
          {sportPitches.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="move-pitch">{t("pitch")}</Label>
              <select
                id="move-pitch"
                className={selectClass}
                value={pitchId}
                onChange={(e) => { setPitchId(e.target.value); setPitchSize("") }}
              >
                {sportPitches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {sizes.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="move-size">{t("pitch_size")}</Label>
              <select
                id="move-size"
                className={selectClass}
                value={pitchSize || sizes[0]}
                onChange={(e) => setPitchSize(e.target.value)}
              >
                {sizes.map((s) => <option key={s} value={s}>{s}-aside</option>)}
              </select>
            </div>
          )}
          {can("payments.record") && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="move-price">{t("move_price")}</Label>
              <Input
                id="move-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={price}
                placeholder={formatCurrency(booking.totalAmount ?? booking.amount)}
                onChange={(e) => setPrice(e.target.value)}
                className="num"
              />
              <p className="text-xs text-[hsl(var(--ink-3))]">{t("move_price_hint")}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>{t("cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={!changed || priceInvalid || save.isPending}>
            {save.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
            {t("move_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
