import { useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type Pitch, type Venue } from "@/api/venues"
import {
  createPermanentBooking,
  type CreatePermanentBookingPayload,
  type PermanentBooking,
} from "@/api/permanentBookings"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { cn } from "@/lib/utils"

const DURATIONS = [60, 90, 120, 180]
const DAYS: TranslationKey[] = [
  "sun_short",
  "mon_short",
  "tue_short",
  "wed_short",
  "thu_short",
  "fri_short",
  "sat_short",
]

interface Props {
  venue: Venue
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (perm: PermanentBooking) => void
}

export function PermanentBookingFormDialog({ venue, open, onOpenChange, onCreated }: Props) {
  const { t } = useT()
  const pitches: Pitch[] = useMemo(() => venue.pitches ?? [], [venue.pitches])

  const [pitchId, setPitchId] = useState<string>(pitches[0]?.id ?? "")
  const [pitchSize, setPitchSize] = useState<string>("")
  const [dayOfWeek, setDayOfWeek] = useState<number>(0)
  const [startTime, setStartTime] = useState<string>("21:00")
  const [duration, setDuration] = useState<number>(60)
  const [label, setLabel] = useState<string>("")

  // Reset form when dialog re-opens.
  useEffect(() => {
    if (!open) return
    setPitchId(pitches[0]?.id ?? "")
    setPitchSize("")
    setDayOfWeek(0)
    setStartTime("21:00")
    setDuration(60)
    setLabel("")
  }, [open, pitches])

  const selectedPitch = useMemo(
    () => pitches.find((p) => p.id === pitchId),
    [pitches, pitchId],
  )

  // Subdividable pitch — owner picks which size to reserve.
  const offeredSizes = useMemo(() => {
    if (!selectedPitch?.parentSize) return []
    const set = new Set<string>([selectedPitch.parentSize])
    for (const s of selectedPitch.subSizes ?? []) set.add(s)
    return Array.from(set)
  }, [selectedPitch])

  // Default size when the pitch is subdividable.
  useEffect(() => {
    if (offeredSizes.length > 0 && !pitchSize) {
      setPitchSize(selectedPitch?.parentSize ?? offeredSizes[0])
    }
    if (offeredSizes.length === 0 && pitchSize) {
      setPitchSize("")
    }
  }, [offeredSizes, pitchSize, selectedPitch])

  const create = useMutation({
    mutationFn: (payload: CreatePermanentBookingPayload) => createPermanentBooking(venue.id, payload),
    onSuccess: (perm) => {
      toast.success(t("permanent_active"))
      onCreated(perm)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error"
      toast.error(msg)
    },
  })

  const submit = () => {
    if (!pitchId) {
      toast.error(t("pick_pitch"))
      return
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      toast.error(t("invalid_time_format"))
      return
    }
    create.mutate({
      pitchId,
      pitchSize: offeredSizes.length > 0 ? pitchSize || null : null,
      dayOfWeek,
      startTime,
      duration,
      label: label.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add_permanent")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pitch */}
          {pitches.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("pick_pitch")}</Label>
              <Select value={pitchId} onValueChange={setPitchId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("pick_pitch")} />
                </SelectTrigger>
                <SelectContent>
                  {pitches.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-[hsl(var(--ink-3))]">· {p.sport}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Size (subdividable pitches only) */}
          {offeredSizes.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("pick_size")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {offeredSizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPitchSize(sz)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-sm transition-colors",
                      pitchSize === sz
                        ? "bg-brand text-brand-foreground border-brand"
                        : "bg-card border-[hsl(var(--line))] text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]",
                    )}
                  >
                    {sz}-aside
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of week */}
          <div className="space-y-1.5">
            <Label>{t("day_of_week")}</Label>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((dKey, idx) => (
                <button
                  key={dKey}
                  type="button"
                  onClick={() => setDayOfWeek(idx)}
                  className={cn(
                    "py-2 rounded-[10px] border text-[12px] font-medium transition-colors",
                    dayOfWeek === idx
                      ? "bg-brand text-brand-foreground border-brand"
                      : "bg-card border-[hsl(var(--line))] text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]",
                  )}
                >
                  {t(dKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Start time */}
          <div className="space-y-1.5">
            <Label>{t("pick_time")}</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mono"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label>{t("pick_duration")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm transition-colors",
                    duration === d
                      ? "bg-brand text-brand-foreground border-brand"
                      : "bg-card border-[hsl(var(--line))] text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))]",
                  )}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <Label>
              {t("permanent_label")}{" "}
              <span className="text-[11px] text-[hsl(var(--ink-3))]">({t("optional") as string})</span>
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 120))}
              placeholder={t("permanent_label_placeholder")}
              maxLength={120}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("add_permanent")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
