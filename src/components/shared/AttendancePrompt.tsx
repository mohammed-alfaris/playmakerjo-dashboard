import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { X, Check, Loader2 } from "lucide-react"
import { getPendingAttendance, confirmAttendance } from "@/api/attendance"
import { markNoShow, type Booking } from "@/api/bookings"
import { Button } from "@/components/ui/button"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatDate } from "@/lib/formatters"
import { bookingPersonName } from "@/lib/bookingParty"

/**
 * "Did anyone not turn up?"
 *
 * The design decision that matters here is the direction of the question. Asking "did these
 * six people come?" costs six taps every day and gets abandoned within a week. Asking
 * "anyone NOT come?" — with everyone assumed present — costs ZERO taps on a normal day, and
 * a tap only when something actually went wrong, which is the behaviour an owner already
 * has with a paper diary.
 *
 * Dismissing the strip writes nothing at all, and that is safe: attendance is derived as
 * "past AND confirmed AND not no_show", so ignoring this forever still yields correct
 * attendance counts. Confirming just turns the assumption into a recorded fact.
 *
 * The failure mode is deliberately one-directional. If the owner never answers, the data
 * says "nobody ever no-showed" and the warning stays silent — annoying but harmless.
 * Guessing the other way and telling an owner a customer no-showed when they did not would
 * cost him a customer and, worse, his trust in every other number in the product.
 */
export function AttendancePrompt() {
  const { t } = useT()
  const qc = useQueryClient()
  const { canWrite } = useRole()
  const [dismissed, setDismissed] = useState(false)

  const { data: pending = [] } = useQuery({
    queryKey: ["attendance-pending"],
    queryFn: () => getPendingAttendance(7),
    enabled: canWrite,
    staleTime: 5 * 60_000,
  })

  const noShow = useMutation({
    mutationFn: (id: string) => markNoShow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-pending"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      toast.success(t("attendance_marked_absent"))
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  const confirmAll = useMutation({
    mutationFn: (ids: string[]) => confirmAttendance(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-pending"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      setDismissed(true)
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  if (!canWrite || dismissed || pending.length === 0) return null

  const personName = (b: Booking) => bookingPersonName(b, t("walk_in_customer"))

  return (
    <div className="mb-4 rounded-xl border border-amber-ink/25 bg-amber-tint/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">
            {t("attendance_prompt_title").replace("{count}", String(pending.length))}
          </div>
          <div className="mt-0.5 text-xs text-ink-3">{t("attendance_prompt_hint")}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => confirmAll.mutate(pending.map((b) => b.id))}
            disabled={confirmAll.isPending}
            className="gap-1.5"
          >
            {confirmAll.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5" />}
            {t("attendance_all_came")}
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2"
            aria-label={t("dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pending.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs text-ink"
          >
            <span className="font-medium">{personName(b)}</span>
            <span className="text-ink-3" dir="ltr">
              {formatDate(b.date)}
              {b.startTime ? ` · ${b.startTime}` : ""}
            </span>
            <button
              type="button"
              onClick={() => noShow.mutate(b.id)}
              disabled={noShow.isPending}
              title={t("attendance_mark_absent")}
              aria-label={`${t("attendance_mark_absent")} — ${personName(b)}`}
              className="rounded-full p-0.5 text-rose-ink hover:bg-rose-tint disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

export default AttendancePrompt
