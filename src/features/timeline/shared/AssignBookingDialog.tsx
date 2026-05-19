import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import api from "@/api/axios"
import type { Pitch } from "@/api/venues"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { parseHHMM, fmt12, hoursFor } from "@/lib/timelineDesign"
import type { OperatingHours } from "@/lib/types"

// ---------------------------------------------------------------------------
// AssignBookingDialog — manual booking creation dialog used by both
// TimelinePage and VenueSlotTimeline.
// ---------------------------------------------------------------------------

export interface AssignBookingDialogProps {
  venueId: string
  date: string
  /** The Date object for the booking day (used to resolve operating hours). */
  bookingDate?: Date
  preset: {
    startMin?: number
    duration?: number
    sport?: string
    pitchId?: string
  } | null
  sports?: string[]
  pricePerHour?: number
  pitches: Pitch[]
  minDuration?: number
  maxDuration?: number
  /** Venue-level operating hours; pitch overrides are checked first. */
  operatingHours?: OperatingHours
  onClose: () => void
}

export function AssignBookingDialog({
  venueId,
  date,
  bookingDate,
  preset,
  sports,
  pricePerHour,
  pitches,
  minDuration,
  maxDuration,
  operatingHours,
  onClose,
}: AssignBookingDialogProps) {
  const { t } = useT()
  const qc = useQueryClient()
  const [sport, setSport] = useState<string>(preset?.sport ?? sports?.[0] ?? "football")
  const [playerName, setPlayerName] = useState("")
  const [notes, setNotes] = useState("")

  const durationOptions = useMemo(() => {
    const all = [30, 60, 90, 120]
    const min = minDuration ?? 60
    const max = maxDuration ?? 180
    const filtered = all.filter((d) => d >= min && d <= max)
    return filtered.length > 0 ? filtered : [min]
  }, [minDuration, maxDuration])
  const [durationChoice, setDurationChoice] = useState<number>(preset?.duration ?? 60)
  const duration = durationOptions.includes(durationChoice)
    ? durationChoice
    : durationOptions[0]

  const sportPitches = useMemo(
    () => pitches.filter((p) => p.sport.toLowerCase() === sport.toLowerCase()),
    [pitches, sport],
  )
  const [pitchIdChoice, setPitchIdChoice] = useState<string>(preset?.pitchId ?? "")
  const pitchId =
    pitchIdChoice && sportPitches.some((p) => p.id === pitchIdChoice)
      ? pitchIdChoice
      : sportPitches[0]?.id ?? ""
  const selectedPitch = useMemo(
    () => sportPitches.find((p) => p.id === pitchId) ?? null,
    [sportPitches, pitchId],
  )

  const offeredSizes = useMemo(() => {
    if (!selectedPitch || selectedPitch.sport.toLowerCase() !== "football") return []
    const parent = selectedPitch.parentSize
    if (!parent) return []
    return [parent, ...(selectedPitch.subSizes ?? [])]
  }, [selectedPitch])
  const effectivePrices: Record<string, number> = useMemo(
    () => selectedPitch?.sizePrices ?? {},
    [selectedPitch],
  )
  const [pitchSizeChoice, setPitchSizeChoice] = useState<string | null>(null)
  const pitchSize: string | null =
    offeredSizes.length === 0
      ? null
      : pitchSizeChoice && offeredSizes.includes(pitchSizeChoice)
        ? pitchSizeChoice
        : offeredSizes[0]

  const [startMin, setStartMin] = useState<number>(preset?.startMin ?? 9 * 60)

  // Day's operating hours: pitch override wins, else venue. Returns null when closed.
  const dayHours = useMemo(
    () =>
      bookingDate
        ? hoursFor(selectedPitch?.operatingHours ?? operatingHours, bookingDate)
        : null,
    [selectedPitch, operatingHours, bookingDate],
  )

  // 30-min slot list within the day's open/close window. Latest start is
  // `close - duration` so the booking always fits before close.
  const startOptions = useMemo(() => {
    if (!dayHours) return []
    const open = parseHHMM(dayHours.open)
    let close = parseHHMM(dayHours.close)
    if (close <= open) close += 24 * 60 // overnight (e.g. open 18:00, close 02:00)
    const last = close - duration
    const out: number[] = []
    for (let m = open; m <= last; m += 30) out.push(m)
    return out
  }, [dayHours, duration])

  // Snap startMin to a valid 30-min slot whenever the available slots change
  // (date, pitch, or duration changed). Avoids leaving the select on a value
  // that no longer exists in the list.
  useEffect(() => {
    if (startOptions.length === 0) return
    if (startOptions.includes(startMin)) return
    const nearest = startOptions.reduce(
      (best, m) => (Math.abs(m - startMin) < Math.abs(best - startMin) ? m : best),
      startOptions[0],
    )
    setStartMin(nearest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOptions])

  const amount = useMemo(() => {
    const hours = duration / 60
    if (pitchSize && effectivePrices[pitchSize] != null) {
      return effectivePrices[pitchSize] * hours
    }
    const rate = selectedPitch?.pricePerHour ?? pricePerHour
    return rate ? rate * hours : null
  }, [pitchSize, effectivePrices, selectedPitch, pricePerHour, duration])

  const create = useMutation({
    mutationFn: async () => {
      const normalized = ((startMin % (24 * 60)) + 24 * 60) % (24 * 60)
      const startHH = String(Math.floor(normalized / 60)).padStart(2, "0")
      const startMM = String(normalized % 60).padStart(2, "0")
      const notePrefix = `[MANUAL] [${sport}]`
      const walkIn = playerName ? ` Walk-in: ${playerName}.` : ""
      const extra = notes ? ` ${notes}` : ""
      const pitchIdToSend =
        pitchId && !pitchId.startsWith("legacy-") ? pitchId : undefined
      const res = await api.post("/bookings", {
        venueId,
        sport,
        date,
        startTime: `${startHH}:${startMM}`,
        duration,
        paymentMethod: "cliq",
        notes: `${notePrefix}${walkIn}${extra}`.trim(),
        isManual: true,
        ...(pitchSize ? { pitchSize } : {}),
        ...(pitchIdToSend ? { pitchId: pitchIdToSend } : {}),
      })
      return res.data
    },
    onSuccess: () => {
      toast.success(t("manual_booking_created"))
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
    },
  })

  // When bookingDate is provided, render the full operating-hours-aware start
  // time selector; otherwise fall back to a simple time input.
  const hasOperatingHours = !!bookingDate

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="display tracking-[-0.02em]">
            {t("draft_review")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("start_time")}>
              {hasOperatingHours ? (
                dayHours ? (
                  <select
                    value={String(startMin)}
                    onChange={(e) => setStartMin(Number(e.target.value))}
                    disabled={startOptions.length === 0}
                    className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none disabled:opacity-50"
                  >
                    {startOptions.length === 0 ? (
                      <option value="">—</option>
                    ) : (
                      startOptions.map((m) => (
                        <option key={m} value={m}>
                          {fmt12(m)}
                        </option>
                      ))
                    )}
                  </select>
                ) : (
                  <div className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm flex items-center text-[hsl(var(--ink-3))]">
                    {t("venue_closed_day")}
                  </div>
                )
              ) : (
                <input
                  type="time"
                  value={`${String(Math.floor(((startMin % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number)
                    setStartMin(h * 60 + m)
                  }}
                  className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
                />
              )}
            </Field>
            <Field label={t("duration")}>
              <select
                value={duration}
                onChange={(e) => setDurationChoice(Number(e.target.value))}
                className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
              >
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {d === 30
                      ? "30 min"
                      : d === 60
                        ? "1 h"
                        : d === 90
                          ? "1 h 30"
                          : d === 120
                            ? "2 h"
                            : `${d} min`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("sport")}>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm capitalize text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
            >
              {(sports && sports.length > 0
                ? sports
                : ["football", "basketball", "tennis", "padel", "volleyball"]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          {sportPitches.length > 1 && (
            <Field label={t("pitch") ?? "Pitch"}>
              <select
                value={pitchId}
                onChange={(e) => setPitchIdChoice(e.target.value)}
                className="h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
              >
                {sportPitches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.parentSize ? ` · ${p.parentSize}-aside` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {offeredSizes.length > 1 && (
            <Field label={t("pitch_size") ?? "Pitch size"}>
              <select
                value={pitchSize ?? ""}
                onChange={(e) => setPitchSizeChoice(e.target.value)}
                className="mono h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"
              >
                {offeredSizes.map((s) => {
                  const price = effectivePrices[s]
                  return (
                    <option key={s} value={s}>
                      {s}-aside
                      {price != null ? ` · ${formatCurrency(price)}/h` : ""}
                    </option>
                  )
                })}
              </select>
            </Field>
          )}

          <Field label={t("player_name")}>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t("player_name_placeholder")}
              className="h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-3))] focus:border-[hsl(var(--brand))] focus:outline-none"
            />
          </Field>

          <Field label={t("notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("notes_placeholder")}
              className="w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 py-1.5 text-sm text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-3))] focus:border-[hsl(var(--brand))] focus:outline-none"
            />
          </Field>

          {amount != null && (
            <div className="flex items-center justify-between rounded-lg bg-[hsl(var(--brand-tint))] px-3 py-2 text-sm">
              <span className="text-[hsl(var(--brand-ink))]">{t("estimated_amount")}</span>
              <span className="mono font-semibold text-[hsl(var(--brand-ink))]">
                {formatCurrency(amount)}
              </span>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            <X className="h-3.5 w-3.5" />
            {t("cancel")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || (hasOperatingHours && (!dayHours || startOptions.length === 0))}
            className="gap-1"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t("draft_create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--ink-3))]">
        {label}
      </span>
      {children}
    </label>
  )
}
