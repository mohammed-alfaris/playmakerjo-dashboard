import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/StatusBadge"
import {
  cancelPermanentBooking,
  listPermanentBookings,
  type PermanentBooking,
} from "@/api/permanentBookings"
import { type Venue } from "@/api/venues"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { PermanentBookingFormDialog } from "./PermanentBookingFormDialog"

const DAY_KEYS: TranslationKey[] = [
  "sun_short",
  "mon_short",
  "tue_short",
  "wed_short",
  "thu_short",
  "fri_short",
  "sat_short",
]

export function PermanentBookingsTab({ venue }: { venue: Venue }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["permanent-bookings", venue.id],
    queryFn: () => listPermanentBookings(venue.id),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => cancelPermanentBooking(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permanent-bookings", venue.id] })
      toast.success(t("permanent_cancelled"))
    },
    onError: () => toast.error("Error"),
  })

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.startTime.localeCompare(b.startTime)
      }),
    [rows],
  )

  // Look up pitch name for a given pitch id (legacy null → "—").
  const pitchName = (pitchId?: string | null) => {
    if (!pitchId) {
      const single = venue.pitches?.[0]
      return single?.name ?? "—"
    }
    const p = (venue.pitches ?? []).find((p) => p.id === pitchId)
    return p?.name ?? pitchId
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-[hsl(var(--ink-2))] max-w-[60ch]">
            {t("permanent_bookings_subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setFormOpen(true)}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("add_permanent")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[12px]" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] p-8 text-center text-sm text-[hsl(var(--ink-3))]">
          {t("permanent_none_yet")}
        </div>
      ) : (
        <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--surface-2))] text-[11px] uppercase tracking-wider text-[hsl(var(--ink-3))]">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("pick_day")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("pick_time")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("pick_duration")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("pick_pitch")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("pick_size")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("permanent_label")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("status")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row: PermanentBooking) => (
                <tr
                  key={row.id}
                  className="border-t border-[hsl(var(--line))]"
                >
                  <td className="px-3 py-3 font-medium">
                    {t(DAY_KEYS[row.dayOfWeek])}
                  </td>
                  <td className="px-3 py-3 mono">{row.startTime}</td>
                  <td className="px-3 py-3">{row.duration} min</td>
                  <td className="px-3 py-3">{pitchName(row.pitchId)}</td>
                  <td className="px-3 py-3">
                    {row.pitchSize ? `${row.pitchSize}-aside` : "—"}
                  </td>
                  <td className="px-3 py-3 text-[hsl(var(--ink-2))]">
                    {row.label || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={row.status === "active" ? "active" : "cancelled"} />
                  </td>
                  <td className="px-3 py-3 text-end">
                    {row.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t("cancel_permanent_confirm"))) {
                            cancel.mutate(row.id)
                          }
                        }}
                        disabled={cancel.isPending}
                        className="text-[hsl(var(--rose))]"
                      >
                        {cancel.isPending && cancel.variables === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PermanentBookingFormDialog
        venue={venue}
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["permanent-bookings", venue.id] })
          setFormOpen(false)
        }}
      />
    </div>
  )
}
