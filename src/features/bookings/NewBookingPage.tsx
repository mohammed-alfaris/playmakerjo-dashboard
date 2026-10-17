import { useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Check, Loader2, CalendarClock, Plus } from "lucide-react"
import { toast } from "sonner"
import api from "@/api/axios"
import { getVenues, type Venue } from "@/api/venues"
import { getDayAvailability, type PitchAvailability } from "@/api/availability"
import CustomerPhoneField, { type CustomerDraft } from "@/features/customers/CustomerPhoneField"
import { addDays, toISODate } from "@/features/timeline/shared/dateUtils"
import { daySlots } from "@/lib/daySlots"
import { clockLabel, sportName } from "@/lib/dayLabels"
import { useOwnerFilter } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

/**
 * A booking taken at the counter or over the phone, on its own page rather than a small
 * dialog: who → which pitch → when → how they pay, every choice visible at once, with the
 * day's real free and taken times and a summary that says exactly what will be booked.
 *
 * Opened from the Today page, the quick-action button, or with ?venue=&date=&pitch=&start=
 * filled in from elsewhere.
 */

const DAYS_AHEAD = 14

/** Radio-style choice card: a real button, its state announced, big enough to tap. */
function Choice({
  selected, disabled, onClick, className, children, label,
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border-2 px-3.5 py-2 text-start text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "border-brand bg-brand-tint text-brand-ink"
          : "border-line bg-card text-ink hover:border-ink-3",
        disabled && "cursor-not-allowed border-dashed opacity-60 hover:border-line",
        className,
      )}
    >
      {children}
    </button>
  )
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  const { lang } = useT()
  const n = lang === "ar" ? "٠١٢٣٤٥٦٧٨٩"[step] : String(step)
  return (
    <fieldset className="min-w-0 rounded-2xl bg-card p-5 shadow-stadium-sm">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden className="mb-4 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-ink-2">{n}</span>
        <span className="display text-[17px] font-semibold text-ink">{title}</span>
      </div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  )
}

export default function NewBookingPage() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const ownerFilter = useOwnerFilter()
  const topRef = useRef<HTMLDivElement>(null)

  const { data: venuesData, isLoading: venuesLoading } = useQuery({
    queryKey: ["timeline-venues", ownerFilter],
    queryFn: () => getVenues({ page: 1, limit: 100, ...ownerFilter }),
  })
  const venues: Venue[] = useMemo(() => venuesData?.data ?? [], [venuesData])

  const [venueChoice, setVenueChoice] = useState(params.get("venue") ?? "")
  const venue = venues.find((v) => v.id === venueChoice) ?? venues[0]

  const today = useMemo(() => new Date(), [])
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)), [today])
  const [date, setDate] = useState(params.get("date") ?? toISODate(today))

  const { data: avail, isLoading: availLoading, isError: availError } = useQuery({
    queryKey: ["day-availability", venue?.id, date],
    queryFn: () => getDayAvailability(venue!.id, date),
    enabled: !!venue,
    // Another desk or the app can take a time while this page is open.
    refetchInterval: 30_000,
  })
  const pitches: PitchAvailability[] = useMemo(() => avail?.pitches ?? [], [avail])

  const sports = useMemo(() => [...new Set(pitches.map((p) => p.sport.toLowerCase()))], [pitches])
  const [sportChoice, setSportChoice] = useState("")
  const sport = sports.includes(sportChoice) ? sportChoice : sports[0] ?? ""
  const sportPitches = useMemo(() => pitches.filter((p) => p.sport.toLowerCase() === sport), [pitches, sport])

  const [pitchChoice, setPitchChoice] = useState(params.get("pitch") ?? "")
  const pitch = sportPitches.find((p) => p.pitchId === pitchChoice) ?? sportPitches[0]
  const pitchNameOf = (p: PitchAvailability) =>
    (lang === "ar" && venue?.pitches?.find((vp) => vp.id === p.pitchId)?.nameAr) || p.name

  const sizes = pitch?.offeredSizes ?? []
  const [sizeChoice, setSizeChoice] = useState<string | null>(null)
  const size = sizes.length ? (sizeChoice && sizes.includes(sizeChoice) ? sizeChoice : sizes[0]) : null

  const durations = useMemo(() => {
    const min = venue?.minBookingDuration ?? avail?.minDuration ?? 60
    const max = venue?.maxBookingDuration ?? avail?.maxDuration ?? 180
    const out: number[] = []
    for (let d = min; d <= max; d += 30) out.push(d)
    return out.length ? out : [60]
  }, [venue, avail])
  const [durationChoice, setDurationChoice] = useState(60)
  const duration = durations.includes(durationChoice) ? durationChoice : durations[0]

  const isToday = date === toISODate(new Date())
  const nowMin = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : null
  const slots = useMemo(
    () => daySlots(pitch, { size, duration, nowMin }),
    [pitch, size, duration, nowMin],
  )
  const presetStart = params.get("start")
  const [timeChoice, setTime] = useState<string | null>(presetStart)
  // A time that stopped being free (another choice changed, or someone else took it) is
  // dropped, never silently kept.
  const time = timeChoice && slots.some((s) => s.time === timeChoice && s.free) ? timeChoice : null

  const [customer, setCustomer] = useState<CustomerDraft>({ phone: "", name: "" })
  const [paid, setPaid] = useState(false)
  const [notes, setNotes] = useState("")
  const [done, setDone] = useState<{ name: string; when: string } | null>(null)

  const hourly = pitch ? (size != null && pitch.sizePrices[size] != null ? pitch.sizePrices[size] : pitch.pricePerHour || venue?.pricePerHour || 0) : 0
  const total = (hourly * duration) / 60

  const dayLabel = (d: Date, i: number) =>
    i === 0 ? t("today") : i === 1 ? t("tomorrow")
      : d.toLocaleDateString(lang === "ar" ? "ar-JO-u-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "short" })
  const dateIdx = days.findIndex((d) => toISODate(d) === date)
  const whenLabel = time
    ? `${dateIdx >= 0 ? dayLabel(days[dateIdx], dateIdx) : date} · ${clockLabel(time, lang)} · ${durationLabel(duration, t)}`
    : "—"
  const customerName = customer.name.trim() || t("walk_in_customer")

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post("/bookings", {
        venueId: venue!.id,
        sport: pitch!.sport,
        date,
        startTime: time,
        duration,
        paymentMethod: "cash",
        // The prefix stays: the read side still recovers names from it on old rows.
        notes: `[MANUAL] [${pitch!.sport}]${notes.trim() ? ` ${notes.trim()}` : ""}`,
        isManual: true,
        customerPhone: customer.phone.trim() || undefined,
        customerName: customer.name.trim() || undefined,
        customerPaid: paid,
        ...(size ? { pitchSize: size } : {}),
        ...(pitch!.pitchId && !pitch!.pitchId.startsWith("legacy-") ? { pitchId: pitch!.pitchId } : {}),
      })
      return res.data
    },
    onSuccess: () => {
      setDone({ name: customerName, when: whenLabel })
      toast.success(t("manual_booking_created"))
      for (const key of ["timeline-bookings", "venue-slots", "bookings", "day-availability", "today-bookings", "customers"]) {
        qc.invalidateQueries({ queryKey: [key] })
      }
      // The layout scrolls its own container, not the window: bring the confirmation into view.
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    },
    onError: (e: { response?: { status?: number; data?: { message?: string } } }) => {
      if (e.response?.status === 409) {
        toast.error(t("qb_time_taken"))
        setTime(null)
        qc.invalidateQueries({ queryKey: ["day-availability"] })
      } else {
        toast.error(e.response?.data?.message ?? t("manual_booking_failed"))
      }
    },
  })

  const startOver = () => {
    setDone(null)
    setTime(null)
    setCustomer({ phone: "", name: "" })
    setNotes("")
    setPaid(false)
  }

  const canSave = !!venue && !!pitch && !!time && !create.isPending

  return (
    <div ref={topRef} className="mx-auto w-full max-w-[1200px] space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("back")}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowRight className="h-5 w-5 ltr:rotate-180" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="display m-0 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">{t("new_booking")}</h1>
          <p className="mt-0.5 text-sm text-ink-3">{t("qb_subtitle")}</p>
        </div>
      </header>

      {done && (
        <div role="status" className="flex flex-wrap items-center gap-4 rounded-2xl bg-brand-tint p-5 text-brand-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">{t("qb_done").replace("{name}", done.name).replace("{when}", done.when)}</div>
            <div className="text-sm opacity-80">{t("qb_done_hint")}</div>
          </div>
          <Link to="/timeline" className="inline-flex h-11 items-center gap-2 rounded-xl px-4 font-semibold underline-offset-4 hover:underline">
            <CalendarClock className="h-4 w-4" />
            {t("qb_open_schedule")}
          </Link>
          <button type="button" onClick={startOver} className="inline-flex h-11 items-center gap-2 rounded-xl border border-current px-4 font-semibold">
            <Plus className="h-4 w-4" />
            {t("qb_another")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) create.mutate()
          }}
        >
          <Section step={1} title={t("qb_step_customer")}>
            <CustomerPhoneField value={customer} onChange={setCustomer} autoFocus />
          </Section>

          <Section step={2} title={t("qb_step_pitch")}>
            {venues.length > 1 && (
              <div role="radiogroup" aria-label={t("venue")} className="flex flex-wrap gap-2">
                {venues.map((v) => (
                  <Choice key={v.id} selected={v.id === venue?.id} onClick={() => setVenueChoice(v.id)} className="px-4 font-medium">
                    {(lang === "ar" && v.nameAr) || v.name}
                  </Choice>
                ))}
              </div>
            )}
            {sports.length > 1 && (
              <div role="radiogroup" aria-label={t("sport")} className="flex flex-wrap gap-2">
                {sports.map((s) => (
                  <Choice key={s} selected={s === sport} onClick={() => setSportChoice(s)} className="px-4 font-medium">
                    {sportName(s, lang)}
                  </Choice>
                ))}
              </div>
            )}
            {venuesLoading || availLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-3"><Loader2 className="h-4 w-4 animate-spin" />{t("loading")}</div>
            ) : availError ? (
              <p className="text-sm text-rose-ink">{t("something_went_wrong")}</p>
            ) : (
              <div role="radiogroup" aria-label={t("pitch")} className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                {sportPitches.map((p) => (
                  <Choice key={p.pitchId} selected={p.pitchId === pitch?.pitchId} onClick={() => setPitchChoice(p.pitchId)}>
                    <span className="block font-semibold">{pitchNameOf(p)}</span>
                    <span className="block text-xs text-ink-3">
                      {p.parentSize ? sizeLabel(t, p.parentSize) : sportName(p.sport, lang)}
                    </span>
                    <span className="num mt-1 block text-sm font-semibold">
                      {t("qb_per_hour").replace("{price}", formatCurrency(p.sizePrices[p.parentSize ?? ""] ?? p.pricePerHour))}
                    </span>
                  </Choice>
                ))}
              </div>
            )}
            {sizes.length > 1 && (
              <div role="radiogroup" aria-label={t("pitch_size")} className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <Choice key={s} selected={s === size} onClick={() => setSizeChoice(s)} className="px-4">
                    <span className="block font-semibold">{sizeLabel(t, s)}</span>
                    {pitch?.sizePrices[s] != null && (
                      <span className="num block text-xs text-ink-3">{t("qb_per_hour").replace("{price}", formatCurrency(pitch.sizePrices[s]))}</span>
                    )}
                  </Choice>
                ))}
              </div>
            )}
          </Section>

          <Section step={3} title={t("qb_step_time")}>
            <div role="radiogroup" aria-label={t("qb_day")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((d, i) => (
                <Choice key={i} selected={toISODate(d) === date} onClick={() => setDate(toISODate(d))} className="shrink-0 whitespace-nowrap px-4 font-medium">
                  {dayLabel(d, i)}
                </Choice>
              ))}
            </div>
            <div role="radiogroup" aria-label={t("duration")} className="flex flex-wrap gap-2">
              {durations.map((d) => (
                <Choice key={d} selected={d === duration} onClick={() => setDurationChoice(d)} className="px-4 font-medium">
                  {durationLabel(d, t)}
                </Choice>
              ))}
            </div>
            {availLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-3"><Loader2 className="h-4 w-4 animate-spin" />{t("loading")}</div>
            ) : !pitch?.operatingHours ? (
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">{t("venue_closed_day")}</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">{t("qb_no_times")}</p>
            ) : (
              <div role="radiogroup" aria-label={t("start_time")} className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
                {slots.map((s) => {
                  const selected = s.time === time
                  return (
                    <Choice
                      key={s.time}
                      selected={selected}
                      disabled={!s.free}
                      onClick={() => setTime(s.time)}
                      className="flex flex-col items-center justify-center py-2.5 text-center"
                      label={`${clockLabel(s.time, lang)} — ${s.free ? (selected ? t("qb_chosen") : t("qb_free")) : t("qb_taken")}`}
                    >
                      <span className={cn("num font-semibold", !s.free && "line-through")}>{clockLabel(s.time, lang)}</span>
                      <span className="text-[11px]">{s.free ? (selected ? t("qb_chosen") : t("qb_free")) : t("qb_taken")}</span>
                    </Choice>
                  )
                })}
              </div>
            )}
          </Section>

          <Section step={4} title={t("qb_step_payment")}>
            <div role="radiogroup" aria-label={t("payment_status")} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Choice selected={!paid} onClick={() => setPaid(false)}>
                <span className="block font-semibold">{t("pays_on_arrival")}</span>
                <span className="block text-xs text-ink-3">{t("qb_pays_later_hint")}</span>
              </Choice>
              <Choice selected={paid} onClick={() => setPaid(true)}>
                <span className="block font-semibold">{t("paid_now")}</span>
                <span className="block text-xs text-ink-3">{t("qb_paid_now_hint")}</span>
              </Choice>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-2">{t("notes")}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t("notes_placeholder")}
                className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
              />
            </label>
          </Section>

          {/* On a phone the summary sits below; this keeps one obvious submit at the end. */}
          <button type="submit" disabled={!canSave} className="sr-only">{t("qb_book")}</button>
        </form>

        <aside aria-label={t("qb_summary")} className="space-y-4 rounded-2xl bg-card p-5 shadow-stadium-sm lg:sticky lg:top-4">
          <h2 className="display m-0 text-[17px] font-semibold text-ink">{t("qb_summary")}</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-3">{t("customer_name")}</dt>
            <dd className="m-0 text-ink">
              {customerName}
              {customer.phone.trim() && <span dir="ltr" className="num block text-xs text-ink-3">{customer.phone}</span>}
            </dd>
            <dt className="text-ink-3">{t("pitch")}</dt>
            <dd className="m-0 text-ink">
              {pitch ? `${pitchNameOf(pitch)}${size ? ` · ${sizeLabel(t, size)}` : ""}` : "—"}
            </dd>
            <dt className="text-ink-3">{t("qb_when")}</dt>
            <dd className="m-0 text-ink">{whenLabel}</dd>
            <dt className="text-ink-3">{t("payment_status")}</dt>
            <dd className="m-0 text-ink">{paid ? t("paid_now") : t("pays_on_arrival")}</dd>
          </dl>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-ink-3">{t("qb_total")}</span>
            <span className="num text-[28px] font-semibold text-ink">{formatCurrency(total)}</span>
          </div>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => create.mutate()}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              canSave ? "bg-primary text-primary-foreground hover:bg-primary/90" : "cursor-not-allowed bg-surface-2 text-ink-3",
            )}
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("qb_book")}
          </button>
          {!time && <p className="m-0 text-sm text-amber-ink">{t("qb_pick_time")}</p>}
          <p className="m-0 text-xs text-ink-3">{t("qb_held_note")}</p>
        </aside>
      </div>
    </div>
  )
}

function durationLabel(min: number, t: (k: "qb_hours" | "qb_minutes") => string) {
  return min % 30 === 0 && min >= 60
    ? t("qb_hours").replace("{n}", String(min / 60))
    : t("qb_minutes").replace("{n}", String(min))
}

/** "{n}-a-side" / "{n} ضد {n}": the Arabic names the number twice. */
function sizeLabel(t: (k: "qb_size_label") => string, n: string) {
  return t("qb_size_label").split("{n}").join(n)
}
