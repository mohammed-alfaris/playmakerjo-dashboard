import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, CheckCircle2, Copy, FileCheck2, Globe, Phone, Plus, Loader2 } from "lucide-react"
import api from "@/api/axios"
import { getBookings, type Booking } from "@/api/bookings"
import { getVenues, type Venue } from "@/api/venues"
import { useAuth } from "@/hooks/useAuth"
import { useOwnerFilter, useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { bookingPersonName } from "@/lib/bookingParty"
import { clockLabel } from "@/lib/dayLabels"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { OnboardingCard } from "@/features/dashboard/OnboardingCard"
import { ProofReviewDialog } from "@/features/bookings/ProofReviewDialog"
import { CancelBookingDialog } from "@/features/bookings/CancelBookingDialog"
import { toISODate } from "@/features/timeline/shared/dateUtils"

/**
 * Today — the home page of the people who run a venue.
 *
 * It answers, in this order: what is waiting for me (web requests to accept, transfer
 * screenshots to check), how is today going, and what is next on the pitches. The old home
 * page opened on revenue charts while those waiting items sat behind the bell or deep in the
 * bookings list; a request nobody answered expires on its own and the slot goes back unsold.
 */

const SITE = "https://playmakerjo.com"
const REFRESH_MS = 30_000

const startMinOf = (b: Booking) => {
  const [h, m] = (b.startTime ?? "00:00").split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
const sortByGame = (a: Booking, b: Booking) =>
  a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) || startMinOf(a) - startMinOf(b)

export default function TodayPage() {
  const { t, lang } = useT()
  const { user } = useAuth()
  const { isOwner, can } = useRole()
  const ownerFilter = useOwnerFilter()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const canManage = can("bookings.manage")
  const canReviewProofs = can("payments.record")

  const { data: venuesData } = useQuery({
    queryKey: ["timeline-venues", ownerFilter],
    queryFn: () => getVenues({ page: 1, limit: 100, ...ownerFilter }),
  })
  const venues: Venue[] = useMemo(() => venuesData?.data ?? [], [venuesData])
  const [venueId, setVenueId] = useState<string>("all")
  const venueFilter = venueId === "all" ? {} : { venue_id: venueId }

  const todayIso = toISODate(new Date())

  // ── what is waiting ──
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["today-requests", venueId, ownerFilter],
    queryFn: () => getBookings({ status: "pending", limit: 50, ...venueFilter, ...ownerFilter }),
    refetchInterval: REFRESH_MS,
  })
  const { data: proofsData, isLoading: proofsLoading } = useQuery({
    queryKey: ["today-proofs", venueId, ownerFilter],
    queryFn: () => getBookings({ status: "pending_review", limit: 50, ...venueFilter, ...ownerFilter }),
    refetchInterval: REFRESH_MS,
  })
  const requests = useMemo(
    () => ((requestsData?.data ?? []) as Booking[]).filter((b) => b.source === "web").sort(sortByGame),
    [requestsData],
  )
  const proofs = useMemo(() => ((proofsData?.data ?? []) as Booking[]).sort(sortByGame), [proofsData])
  const waitingCount = requests.length + proofs.length

  // ── today ──
  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ["today-bookings", venueId, todayIso, ownerFilter],
    queryFn: () => getBookings({ from: todayIso, to: todayIso, limit: 200, page: 1, ...venueFilter, ...ownerFilter }),
    refetchInterval: REFRESH_MS,
  })
  const todays = useMemo(
    () => ((todayData?.data ?? []) as Booking[]).filter((b) => b.status !== "cancelled").sort(sortByGame),
    [todayData],
  )
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const upcoming = todays.filter((b) => startMinOf(b) + b.duration > nowMin && b.status !== "no_show")
  const notStarted = todays.filter((b) => startMinOf(b) > nowMin).length
  const collected = todays.reduce((s, b) => s + (b.amountPaid ?? 0), 0)
  const toCollect = todays
    .filter((b) => b.status !== "no_show")
    .reduce((s, b) => s + Math.max(0, (b.totalAmount ?? b.amount ?? 0) - (b.amountPaid ?? 0)), 0)

  // ── actions ──
  const refresh = () => {
    for (const key of ["today-requests", "today-proofs", "today-bookings", "timeline-bookings", "bookings", "day-availability"]) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }
  const [accepted, setAccepted] = useState<Record<string, boolean>>({})
  const accept = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/confirm`),
    onSuccess: (_r, id) => {
      setAccepted((a) => ({ ...a, [id]: true }))
      toast.success(t("web_request_accepted"))
      refresh()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })
  const [declining, setDeclining] = useState<Booking | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)

  const firstName = user?.name?.split(" ")[0] ?? ""
  const hour = now.getHours()
  const greetKey = (hour < 12 ? "greeting_morning" : hour < 18 ? "greeting_afternoon" : "greeting_evening") as
    "greeting_morning" | "greeting_afternoon" | "greeting_evening"
  const dateLabel = now.toLocaleDateString(lang === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long" })
  const linkVenues = (venueId === "all" ? venues : venues.filter((v) => v.id === venueId)).slice(0, 3)

  const whenOf = (b: Booking) => {
    const d = b.date.slice(0, 10)
    const day = d === todayIso ? t("today") : d === toISODate(new Date(now.getTime() + 86_400_000)) ? t("tomorrow")
      : new Date(`${d}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "short" })
    return `${day} · ${clockLabel(b.startTime ?? "00:00", lang)}`
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      {isOwner && <OnboardingCard />}

      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="text-sm text-ink-3">{dateLabel}</div>
          <h1 className="display m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {t(greetKey)}{firstName ? `${lang === "ar" ? "،" : ","} ${firstName}` : ""}
          </h1>
        </div>
        {venues.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-3">{t("venue")}</span>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="h-11 min-w-[200px] rounded-xl border border-line bg-card px-3 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="all">{t("today_all_venues").replace("{n}", String(venues.length))}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{(lang === "ar" && v.nameAr) || v.name}</option>
              ))}
            </select>
          </label>
        )}
        {canManage && (
          <Link
            to={venueId === "all" ? "/bookings/new" : `/bookings/new?venue=${venueId}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-4 w-4" />
            {t("new_booking")}
          </Link>
        )}
      </header>

      {/* Today at a glance */}
      <section aria-label={t("today_glance")} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label={t("today_bookings")} value={todayLoading ? "—" : String(todays.length)}
          note={t("today_not_started").replace("{n}", String(notStarted))} />
        <Stat label={t("today_collected")} value={todayLoading ? "—" : formatCurrency(collected)} note={t("today_collected_note")} />
        <Stat label={t("today_to_collect")} value={todayLoading ? "—" : formatCurrency(toCollect)} note={t("today_to_collect_note")} />
        <Stat label={t("today_waiting")} value={String(waitingCount)} note={t("today_waiting_note")} highlight={waitingCount > 0} />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Waiting for you */}
        <section aria-labelledby="waiting-title" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="waiting-title" className="display m-0 text-[20px] font-semibold text-ink">{t("today_needs_you")}</h2>
            {waitingCount > 0 && (
              <span className="num inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-tint px-2 text-sm font-semibold text-amber-ink">
                {waitingCount}
              </span>
            )}
            <span className="basis-full text-sm text-ink-3 sm:basis-auto">{t("today_needs_you_hint")}</span>
          </div>

          {(requestsLoading || proofsLoading) && waitingCount === 0 ? (
            <div className="flex items-center gap-2 rounded-2xl bg-card p-5 text-sm text-ink-3 shadow-stadium-sm">
              <Loader2 className="h-4 w-4 animate-spin" />{t("loading")}
            </div>
          ) : waitingCount === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-card p-5 shadow-stadium-sm">
              <CheckCircle2 className="h-6 w-6 text-brand" />
              <div>
                <div className="font-semibold text-ink">{t("today_all_clear")}</div>
                <div className="text-sm text-ink-3">{t("today_all_clear_hint")}</div>
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {requests.map((b) => (
                <TaskCard
                  key={b.id}
                  kind="web"
                  booking={b}
                  when={whenOf(b)}
                  done={accepted[b.id] ? t("today_accepted") : null}
                  actions={canManage ? (
                    <>
                      <button
                        type="button"
                        disabled={accept.isPending}
                        onClick={() => accept.mutate(b.id)}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {accept.isPending && accept.variables === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {t("web_request_accept")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclining(b)}
                        className="inline-flex h-11 items-center rounded-xl border border-line-strong px-4 font-medium text-ink hover:bg-surface-2"
                      >
                        {t("web_request_decline")}
                      </button>
                    </>
                  ) : null}
                />
              ))}
              {proofs.map((b) => (
                <TaskCard
                  key={b.id}
                  kind="proof"
                  booking={b}
                  when={whenOf(b)}
                  done={null}
                  actions={canReviewProofs ? (
                    <button
                      type="button"
                      onClick={() => setReviewing(b.id)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <FileCheck2 className="h-4 w-4" />
                      {t("review_proof")}
                    </button>
                  ) : null}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {/* Next on the pitches */}
          <section aria-labelledby="next-title" className="rounded-2xl bg-card p-5 shadow-stadium-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="next-title" className="display m-0 text-[18px] font-semibold text-ink">{t("today_next")}</h2>
              <Link to="/timeline" className="text-sm font-semibold text-brand-ink underline-offset-4 hover:underline">
                {t("qb_open_schedule")}
              </Link>
            </div>
            {todayLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-ink-3"><Loader2 className="h-4 w-4 animate-spin" />{t("loading")}</div>
            ) : upcoming.length === 0 ? (
              <p className="py-3 text-sm text-ink-3">{t("today_nothing_next")}</p>
            ) : (
              <ol className="divide-y divide-line">
                {upcoming.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => navigate("/timeline")}
                      className="flex w-full items-center gap-3 py-3 text-start hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="num w-[72px] shrink-0 text-sm font-semibold text-ink">{clockLabel(b.startTime ?? "00:00", lang)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{bookingPersonName(b, t("walk_in_customer"))}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {(lang === "ar" && venues.find((v) => v.id === b.venue.id)?.nameAr) || b.venue.name}
                          {b.source === "web" ? ` · ${t("channel_web")}` : ""}
                        </span>
                      </span>
                      <StatusBadge status={b.status} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Booking links */}
          {linkVenues.some((v) => v.slug) && (
            <section aria-labelledby="links-title" className="rounded-2xl bg-card p-5 shadow-stadium-sm">
              <h2 id="links-title" className="display m-0 mb-1 text-[18px] font-semibold text-ink">{t("booking_link")}</h2>
              <p className="m-0 mb-3 text-sm text-ink-3">{t("today_links_hint")}</p>
              <ul className="space-y-2">
                {linkVenues.filter((v) => v.slug).map((v) => (
                  <LinkRow key={v.id} venue={v} lang={lang} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <CancelBookingDialog booking={declining} onClose={() => setDeclining(null)} onCancelled={() => { setDeclining(null); refresh() }} />
      <ProofReviewDialog bookingId={reviewing} open={!!reviewing} onClose={() => { setReviewing(null); refresh() }} />
    </div>
  )
}

function Stat({ label, value, note, highlight }: { label: string; value: string; note: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-card p-4 shadow-stadium-sm sm:p-5", highlight && "ring-2 ring-amber/60")}>
      <div className="text-sm text-ink-3">{label}</div>
      <div className="num mt-1 text-[22px] font-semibold leading-tight text-ink sm:text-[30px]">{value}</div>
      <div className="mt-1 text-sm text-ink-2">{note}</div>
    </div>
  )
}

function TaskCard({
  kind, booking, when, actions, done,
}: { kind: "web" | "proof"; booking: Booking; when: string; actions: React.ReactNode; done: string | null }) {
  const { t, lang } = useT()
  const Icon = kind === "web" ? Globe : FileCheck2
  const phone = booking.customer?.phone
  const amount = kind === "proof" ? booking.depositAmount ?? 0 : booking.totalAmount ?? booking.amount
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4 shadow-stadium-sm">
      <span
        aria-hidden
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          kind === "web" ? "bg-sky-tint text-sky-ink" : "bg-amber-tint text-amber-ink",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-[1_1_260px] space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            kind === "web" ? "bg-sky-tint text-sky-ink" : "bg-amber-tint text-amber-ink",
          )}>
            {kind === "web" ? t("today_tag_web") : t("today_tag_proof")}
          </span>
          <span className="font-semibold text-ink">{bookingPersonName(booking, t("walk_in_customer"))}</span>
          {phone && (
            <a href={`tel:${phone}`} dir="ltr" className="num inline-flex items-center gap-1 text-sm text-brand-ink underline-offset-4 hover:underline">
              <Phone className="h-3.5 w-3.5" />{phone}
            </a>
          )}
        </div>
        <div className="text-sm text-ink-2">
          {booking.venue.name} · {when} · {formatCurrency(amount)}
          {kind === "proof" ? ` (${t("today_deposit")})` : ""}
        </div>
        {kind === "web" && booking.paymentDeadlineAt && (
          <div className="text-xs text-ink-3">
            {t("today_expires_at").replace("{time}", new Date(booking.paymentDeadlineAt).toLocaleTimeString(lang === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { hour: "numeric", minute: "2-digit" }))}
          </div>
        )}
      </div>
      {done ? (
        <span role="status" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-tint px-3.5 text-sm font-semibold text-brand-ink">
          <Check className="h-4 w-4" />{done}
        </span>
      ) : (
        actions && <div className="flex flex-wrap gap-2">{actions}</div>
      )}
    </li>
  )
}

function LinkRow({ venue, lang }: { venue: Venue; lang: string }) {
  const { t } = useT()
  const url = `${SITE}/v/${venue.slug}`
  const [copied, setCopied] = useState(false)
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{(lang === "ar" && venue.nameAr) || venue.name}</div>
        <div dir="ltr" className="num truncate text-xs text-ink-3">{url.replace("https://", "")}</div>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1800)
          } catch { /* clipboard blocked: the link is on screen */ }
        }}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface-2"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? t("copied") : t("copy")}
      </button>
      <Link to={`/venues/${venue.id}`} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-brand-ink underline-offset-4 hover:underline">
        {t("booking_link_qr")}
      </Link>
    </li>
  )
}
