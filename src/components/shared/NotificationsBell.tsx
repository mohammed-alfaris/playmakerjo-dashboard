import { useEffect, useRef, useState } from "react"
import { Bell, CheckCheck, Loader2, Megaphone } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getBooking, type Booking } from "@/api/bookings"
import { getInbox, markInboxAllRead, markInboxItemRead, type InboxItem } from "@/api/notifications"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ProofReviewDialog } from "@/features/bookings/ProofReviewDialog"
import { BookingDrawer } from "@/features/timeline/shared/BookingDrawer"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { SCHEDULE_EVENTS, ago, freshArrivals, localized, targetOf } from "@/lib/inbox"
import { cn } from "@/lib/utils"

const POLL_MS = 30_000

/**
 * A short two-note chime for a new booking or proof. Generated, not a sound file, so there is
 * nothing to load. Browsers only allow audio after the user has interacted with the page —
 * at a desk they always have; if not, it stays silent rather than failing.
 */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notes = [880, 1320]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const t0 = ctx.currentTime + i * 0.14
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.24)
    })
    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // No audio is not an error.
  }
}

/**
 * Everyone's inbox: the owner's new app bookings, proofs to review and cancellations; the
 * admin's new leads. It polls every 30 seconds; a new booking or proof also chimes, pops a
 * toast and refreshes the schedule, so the desk hears about it without watching the screen.
 *
 * It used to be admin-only, a link to the broadcast console — and its badge read the wrong
 * field ("unread_count" where the API sends "unreadCount"), so it never showed a number.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const { t, lang } = useT()
  const { isAdmin } = useRole()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [drawerBooking, setDrawerBooking] = useState<Booking | null>(null)
  const [proofId, setProofId] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => getInbox(20),
    refetchInterval: POLL_MS,
    // Keep listening while the tab is in the background — the chime matters most when the
    // dashboard sits in one tab and the owner works in another. (Browsers slow background
    // timers to about once a minute, which is fine.) The schedule itself does not poll in the
    // background: this invalidates it on arrival, and it refetches on focus anyway.
    refetchIntervalInBackground: true,
    staleTime: 0,
  })
  const items = data?.items ?? []
  const unread = data?.unreadCount ?? 0

  // Announce arrivals once each. The first answer after login only marks what is there as
  // seen; nothing old rings.
  const seen = useRef<Set<string> | null>(null)
  const [openedAt] = useState(() => Date.now())
  useEffect(() => {
    if (!data) return
    if (seen.current == null) {
      seen.current = new Set(data.items.map((n) => n.id))
      return
    }
    const fresh = freshArrivals(data.items, seen.current, openedAt)
    if (fresh.length === 0) return
    fresh.forEach((n) => seen.current!.add(n.id))

    if (fresh.some((n) => SCHEDULE_EVENTS.has(n.type))) {
      qc.invalidateQueries({ queryKey: ["timeline-bookings"] })
      qc.invalidateQueries({ queryKey: ["timeline-week"] })
      qc.invalidateQueries({ queryKey: ["bookings"] })
      chime()
    }
    fresh.slice(0, 3).forEach((n) => toast(localized(n.title, lang), { description: localized(n.body, lang) }))
  }, [data, qc, lang, openedAt])

  const markRead = useMutation({
    mutationFn: markInboxItemRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  })
  const markAll = useMutation({
    mutationFn: markInboxAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  })

  async function openItem(n: InboxItem) {
    if (!n.isRead) markRead.mutate(n.id)
    const target = targetOf(n)
    if (target.kind === "route") {
      setOpen(false)
      navigate(target.path)
    } else if (target.kind === "proof") {
      setOpen(false)
      setProofId(target.bookingId)
    } else if (target.kind === "booking") {
      setOpening(n.id)
      try {
        const booking = await getBooking(target.bookingId)
        setOpen(false)
        setDrawerBooking(booking)
      } catch {
        toast.error(t("inbox_booking_gone"))
      } finally {
        setOpening(null)
      }
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={t("inbox_title")}>
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">{t("inbox_title")}</span>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                <CheckCheck className="h-3.5 w-3.5" />
                {t("inbox_mark_all")}
              </Button>
            )}
          </div>

          <ul className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">{t("inbox_empty")}</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void openItem(n)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-start last:border-0 hover:bg-muted/50",
                    !n.isRead && "bg-primary/5",
                  )}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", !n.isRead && "font-semibold")}>{localized(n.title, lang)}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {opening === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : ago(n.createdAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{localized(n.body, lang)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {isAdmin && (
            <button
              type="button"
              onClick={() => { setOpen(false); navigate("/notifications") }}
              className="flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
            >
              <Megaphone className="h-3.5 w-3.5" />
              {t("inbox_broadcast_console")}
            </button>
          )}
        </PopoverContent>
      </Popover>

      {drawerBooking && (
        <BookingDrawer
          booking={drawerBooking}
          onClose={() => setDrawerBooking(null)}
          onView={() => {
            const b = drawerBooking
            const day = b.date.slice(0, 10)
            setDrawerBooking(null)
            navigate(`/bookings?venue=${b.venue.id}&from=${day}&to=${day}`)
          }}
          onCompleted={() => setDrawerBooking(null)}
        />
      )}

      <ProofReviewDialog bookingId={proofId} open={!!proofId} onClose={() => setProofId(null)} />
    </>
  )
}
