import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBlock } from "@/api/blocks"
import type { Pitch } from "@/api/venues"
import { useT } from "@/i18n/LanguageContext"

const selectClass =
  "h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * Close time to bookings: one pitch or the whole venue, from one moment to another (it may
 * run over several days, for a holiday). Bookings already inside it are not touched — the
 * answer lists them so the desk can move or cancel each one with its customer.
 */
export function BlockTimeDialog({
  venueId,
  pitches,
  date,
  onClose,
}: {
  venueId: string
  pitches: Pitch[]
  /** The day on screen, "yyyy-MM-dd": where the form starts. */
  date: string
  onClose: () => void
}) {
  const { t } = useT()
  const qc = useQueryClient()
  const [pitchId, setPitchId] = useState("")
  const [fromDate, setFromDate] = useState(date)
  const [fromTime, setFromTime] = useState("18:00")
  const [toDate, setToDate] = useState(date)
  const [toTime, setToTime] = useState("20:00")
  const [reason, setReason] = useState("")

  const startsAt = `${fromDate}T${fromTime}`
  const endsAt = `${toDate}T${toTime}`
  const ordered = endsAt > startsAt

  const save = useMutation({
    mutationFn: () => createBlock(venueId, { pitchId: pitchId || null, startsAt, endsAt, reason: reason.trim() || undefined }),
    onSuccess: ({ overlappingBookings }) => {
      if (overlappingBookings.length > 0) {
        toast.warning(t("block_overlaps").replace("{count}", String(overlappingBookings.length)), { duration: 10_000 })
      } else {
        toast.success(t("block_saved"))
      }
      qc.invalidateQueries({ queryKey: ["venue-blocks"] })
      qc.invalidateQueries({ queryKey: ["venue-slots"] })
      onClose()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("block_time")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {pitches.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="block-pitch">{t("pitch")}</Label>
              <select id="block-pitch" className={selectClass} value={pitchId} onChange={(e) => setPitchId(e.target.value)}>
                <option value="">{t("block_whole_venue")}</option>
                {pitches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="block-from-date">{t("block_from")}</Label>
              <Input id="block-from-date" type="date" value={fromDate} className="num"
                onChange={(e) => { setFromDate(e.target.value); if (toDate < e.target.value) setToDate(e.target.value) }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-from-time" className="invisible">{t("block_from")}</Label>
              <Input id="block-from-time" type="time" step={900} value={fromTime} className="num w-28" onChange={(e) => setFromTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-to-date">{t("block_to")}</Label>
              <Input id="block-to-date" type="date" value={toDate} min={fromDate} className="num" onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-to-time" className="invisible">{t("block_to")}</Label>
              <Input id="block-to-time" type="time" step={900} value={toTime} className="num w-28" onChange={(e) => setToTime(e.target.value)} />
            </div>
          </div>
          {!ordered && <p className="text-xs text-destructive">{t("block_end_after_start")}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">{t("block_reason")}</Label>
            <Input id="block-reason" maxLength={200} value={reason} placeholder={t("block_reason_placeholder")} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>{t("cancel")}</Button>
          <Button onClick={() => save.mutate()} disabled={!ordered || save.isPending}>
            {save.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
            {t("block_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
