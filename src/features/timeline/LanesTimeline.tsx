import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react"
import { cn } from "@/lib/utils"
import { Chip } from "@/components/shared/design/Chip"
import {
  HOURS_START,
  HOURS_END,
  PX_PER_MIN,
  LANE_H,
  STATUS_META,
  GROUP_META,
  GROUP_TRANSLATION_KEY,
  colorFor,
  assignLanes,
  bookingToLane,
  renderStatusFor,
  lanesFor,
  hoursFor,
  parseHHMM,
  fmtRange,
  type LaneAssignment,
} from "@/lib/timelineDesign"
import { formatCurrency } from "@/lib/formatters"
import { useT } from "@/i18n/LanguageContext"
import type { Pitch, Venue } from "@/api/venues"
import type { Booking } from "@/api/bookings"

// ---------------------------------------------------------------------------
// LanesTimeline — the "Clean" Lanes grid (ported from timeslots-clean.jsx).
// Used by both the full Timeslots page and the compact VenueSlotTimeline on
// the profile. Absolute-positioned booking blocks on a fixed minute axis
// (HOURS_START..HOURS_END × PX_PER_MIN).
// Responsibilities: layout + hover peek + drag-on-empty. Data fetch,
// mutations, and wrapping shell live in the caller.
// ---------------------------------------------------------------------------

export interface LanesTimelineProps {
  venue: Pick<Venue, "id" | "operatingHours" | "pitches">
  bookings: Booking[]
  date: Date
  /** Optional callback when the user clicks an open slot (or drags to select a range). */
  onCreate?: (args: { pitchId: string; sport: string; startMin: number; duration: number }) => void
  /** Optional callback when the user clicks an existing booking. Opens the drawer on the caller. */
  onOpenBooking?: (booking: Booking) => void
  /** Hide the 4-status legend at the bottom (used by the compact variant). */
  hideLegend?: boolean
  /** Compact mode lowers label column width; used by the embedded profile timeline. */
  compact?: boolean
  /** Left label column width; defaults to 180 for full, 148 for compact. */
  labelWidth?: number
  canManage?: boolean
}

interface PitchRow {
  pitch: Pitch
  lanes: number
  assignments: LaneAssignment<ReturnType<typeof bookingToLane> & { _orig: Booking }>[]
}

export function LanesTimeline({
  venue,
  bookings,
  date,
  onCreate,
  onOpenBooking,
  hideLegend,
  compact,
  labelWidth,
  canManage,
}: LanesTimelineProps) {
  const { t, lang } = useT()
  const pxPerMin = PX_PER_MIN
  const frameStart = HOURS_START * 60
  const frameEnd = HOURS_END * 60
  const frameWidth = (frameEnd - frameStart) * pxPerMin
  // Both modes use 180px so real pitch names ("basketball", "volleyball court 1")
  // never truncate. Compact mode still feels tighter via smaller label padding.
  const resolvedLabelWidth = labelWidth ?? 180

  const pitches = useMemo(() => venue.pitches ?? [], [venue.pitches])

  // Build per-pitch row (with lane assignments)
  const rows: PitchRow[] = useMemo(() => {
    const out: PitchRow[] = []
    for (const pitch of pitches) {
      const laneCount = lanesFor(pitch)
      const pitchBookings: Array<ReturnType<typeof bookingToLane> & { _orig: Booking }> = bookings
        .filter((b) => {
          if (b.pitchId) return b.pitchId === pitch.id
          // fallback: sport match (should not normally happen)
          return b.sport?.toLowerCase() === pitch.sport.toLowerCase()
        })
        .map((b) => ({ ...bookingToLane(b), _orig: b }))
      const assignments = assignLanes(pitch, pitchBookings)
      out.push({ pitch, lanes: laneCount, assignments })
    }
    return out
  }, [pitches, bookings])

  // NOW line: only show if date is today and the time is inside the frame
  const now = new Date()
  const isToday = sameYMD(date, now)
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1
  const showNow = isToday && nowMin >= frameStart && nowMin <= frameEnd
  const nowX = showNow ? (nowMin - frameStart) * pxPerMin : 0
  const pastWidth = isToday && nowMin > frameStart
    ? Math.max(0, (Math.min(nowMin, frameEnd) - frameStart) * pxPerMin)
    : 0

  // Live re-render tick so NOW line moves every minute
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isToday) return
    const i = window.setInterval(() => setTick((x) => x + 1), 60_000)
    return () => window.clearInterval(i)
  }, [isToday])

  // Peek (hover card)
  const [peek, setPeek] = useState<{ x: number; y: number; booking: Booking } | null>(null)

  // Drag-to-create state — only engaged on empty area
  const [draft, setDraft] = useState<{
    pitchId: string
    sport: string
    startMin: number
    endMin: number
    row: number
    laneCount: number
  } | null>(null)
  const dragRef = useRef<{ pitchId: string; sport: string; startX: number; row: number; laneCount: number } | null>(null)

  function clientXToMin(clientX: number, grid: HTMLDivElement): number {
    const box = grid.getBoundingClientRect()
    const offset = clientX - box.left
    const raw = frameStart + offset / pxPerMin
    // Snap to 15 minutes
    const snapped = Math.round(raw / 15) * 15
    return Math.max(frameStart, Math.min(frameEnd, snapped))
  }

  function onGridMouseDown(
    ev: ReactMouseEvent<HTMLDivElement>,
    pitch: Pitch,
    row: number,
    laneCount: number,
  ) {
    if (!canManage || !onCreate) return
    // Don't start drag if click originated from a booking block
    const target = ev.target as HTMLElement
    if (target.closest("[data-booking-block]")) return
    const grid = ev.currentTarget
    const startMin = clientXToMin(ev.clientX, grid)
    dragRef.current = { pitchId: pitch.id, sport: pitch.sport, startX: startMin, row, laneCount }
    setDraft({
      pitchId: pitch.id,
      sport: pitch.sport,
      startMin,
      endMin: Math.min(frameEnd, startMin + 60),
      row,
      laneCount,
    })
    // Attach listeners on window so we keep receiving events even when leaving the grid
    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const m = clientXToMin(e.clientX, grid)
      const s = Math.min(d.startX, m)
      const e2 = Math.max(d.startX + 30, Math.max(d.startX, m))
      setDraft({ pitchId: d.pitchId, sport: d.sport, startMin: s, endMin: e2, row: d.row, laneCount: d.laneCount })
    }
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
      dragRef.current = null
      setDraft((cur) => {
        if (!cur) return null
        if (cur.endMin - cur.startMin >= 30 && onCreate) {
          onCreate({
            pitchId: cur.pitchId,
            sport: cur.sport,
            startMin: cur.startMin,
            duration: cur.endMin - cur.startMin,
          })
        }
        return null
      })
      document.body.classList.remove("no-select")
    }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    document.body.classList.add("no-select")
  }

  // -------------------------------------------------------------------------
  // Hour ticks (header) — 2-digit 24h labels
  // -------------------------------------------------------------------------
  const hourTicks: number[] = []
  for (let m = frameStart; m <= frameEnd; m += 60) hourTicks.push(m)

  return (
    <div className="relative rounded-[16px] bg-card border border-[hsl(var(--line))] shadow-sm-stadium overflow-hidden">
      {/* Hour strip + pitch rows, horizontally scrollable on overflow */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: resolvedLabelWidth + frameWidth + 16 }}>
          {/* Hour header — flat strip on surface-2 background */}
          <div
            className="flex border-b border-[hsl(var(--line))] bg-[hsl(var(--surface-2))]"
            style={{ paddingInlineStart: resolvedLabelWidth }}
          >
            <div
              className="relative"
              style={{ width: frameWidth, height: compact ? 34 : 38 }}
            >
              {hourTicks.map((m, i) => {
                const h = Math.floor((m % (24 * 60)) / 60)
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 flex items-center"
                    style={{ left: (m - frameStart) * pxPerMin, paddingInlineStart: 8 }}
                  >
                    <span className="mono text-[10.5px] font-semibold text-[hsl(var(--ink-3))]">
                      {String(h).padStart(2, "0")}
                    </span>
                  </div>
                )
              })}
              {/* NOW line in the ruler + NOW badge */}
              {showNow && (
                <div
                  className="absolute top-0 z-[3] pointer-events-none"
                  style={{ left: nowX, width: 2, bottom: -2, background: "hsl(var(--brand))", borderRadius: 1 }}
                  aria-hidden
                >
                  <div
                    className="absolute inline-flex items-center rounded-[4px] font-extrabold"
                    style={{
                      top: 6,
                      insetInlineStart: -13,
                      fontSize: 9,
                      letterSpacing: "0.04em",
                      color: "hsl(var(--brand))",
                      background: "hsl(var(--brand-tint))",
                      padding: "2px 5px",
                    }}
                  >
                    {t("now_label").toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pitch rows */}
          <div className="relative">
            {rows.length === 0 && (
              <div className="p-10 text-center">
                <p className="text-sm text-[hsl(var(--ink-2))]">{t("no_venues_available")}</p>
              </div>
            )}
            {rows.map((row, rowIdx) => {
              const pitch = row.pitch
              const rowHeight = Math.max(1, row.lanes) * LANE_H
              const dh = hoursFor(venue.operatingHours, date) ?? hoursFor(pitch.operatingHours ?? undefined, date)
              const openMin = dh ? parseHHMM(dh.open) : null
              const closeMin = dh ? parseHHMM(dh.close) : null
              // Hatched windows for outside-operating-hours (kept as hatched);
              // past-area uses a soft surface-2 dimmer (handled below).
              const hatches: Array<{ left: number; width: number }> = []
              if (!dh) {
                hatches.push({ left: 0, width: frameWidth })
              } else if (openMin != null && closeMin != null) {
                const open = openMin
                const close = closeMin <= openMin ? closeMin + 24 * 60 : closeMin
                if (open > frameStart) {
                  hatches.push({ left: 0, width: Math.max(0, (open - frameStart) * pxPerMin) })
                }
                if (close < frameEnd) {
                  const l = (close - frameStart) * pxPerMin
                  hatches.push({ left: Math.max(0, l), width: Math.max(0, frameWidth - l) })
                }
              }

              // Pitch label: list of offered sizes (for chips)
              const offeredSizes = pitch.sport === "football" && pitch.parentSize
                ? [pitch.parentSize, ...(pitch.subSizes ?? [])]
                : pitch.parentSize
                  ? [pitch.parentSize]
                  : []

              return (
                <Fragment key={pitch.id}>
                  <div className="flex border-t border-[hsl(var(--line))]">
                    {/* Pitch label panel */}
                    <div
                      style={{ width: resolvedLabelWidth, padding: compact ? "10px 12px" : "14px 16px" }}
                      className="flex-none border-e border-[hsl(var(--line))] bg-card"
                    >
                      <div className="text-[13.5px] font-bold text-[hsl(var(--ink))] truncate">
                        {pitch.name}
                      </div>
                      <div className="text-[11px] text-[hsl(var(--ink-3))] capitalize mt-[3px] truncate">
                        {pitch.parentSize ? `${pitch.parentSize}-a-side` : pitch.sport}
                        {pitch.subSizes && pitch.subSizes.length > 0
                          ? ` · ${pitch.subSizes.join("+")} ${lang === "ar" ? "تقسيمات" : "splits"}`
                          : ""}
                      </div>
                      {offeredSizes.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {offeredSizes.map((s) => {
                            const price = pitch.sizePrices?.[s] ?? pitch.pricePerHour
                            return (
                              <span
                                key={s}
                                className="num inline-block text-[10.5px] font-bold px-1.5 py-[2px] rounded-md text-[hsl(var(--ink-2))]"
                                style={{ background: "hsl(var(--surface-2))" }}
                              >
                                {s}v{s}
                                {price != null ? ` · ${price}JD` : ""}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Body. overflow-hidden keeps booking blocks that fall
                        outside the [HOURS_START, HOURS_END] frame from
                        bleeding left onto the label column. */}
                    <div
                      className="relative flex-1 bg-card overflow-hidden"
                      style={{
                        minWidth: frameWidth,
                        height: rowHeight,
                        cursor: canManage && onCreate ? "crosshair" : "default",
                      }}
                      onMouseDown={(e) => onGridMouseDown(e, pitch, rowIdx, row.lanes)}
                    >
                      {/* Subtle hour tick verticals (very faint) */}
                      {hourTicks.slice(1).map((m, i) => (
                        <div
                          key={i}
                          className="absolute inset-y-0 pointer-events-none"
                          style={{
                            left: (m - frameStart) * pxPerMin,
                            width: 1,
                            background: "hsl(var(--line))",
                            opacity: 0.5,
                          }}
                          aria-hidden
                        />
                      ))}

                      {/* Lane dividers — dashed between lanes only */}
                      {row.lanes > 1 && Array.from({ length: row.lanes - 1 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute inset-x-0 pointer-events-none"
                          style={{
                            top: (i + 1) * LANE_H,
                            height: 1,
                            borderTop: "1px dashed hsl(var(--line))",
                          }}
                          aria-hidden
                        />
                      ))}

                      {/* Hatched windows for closed operating-hours */}
                      {hatches.map((h, i) => (
                        <div
                          key={i}
                          className="absolute inset-y-0 hatched pointer-events-none"
                          style={{ left: h.left, width: h.width }}
                          aria-hidden
                        />
                      ))}

                      {/* Past dimmer — soft surface-2 overlay */}
                      {pastWidth > 0 && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{
                            insetInlineStart: 0,
                            width: pastWidth,
                            background: "hsl(var(--surface-2))",
                            opacity: 0.4,
                          }}
                          aria-hidden
                        />
                      )}

                      {/* Bookings */}
                      {row.assignments.map((a) => (
                        <BookingBlock
                          key={a.booking.id}
                          booking={a.booking._orig}
                          startMin={a.booking.startMin}
                          duration={a.booking.duration}
                          topLane={a.topLane}
                          laneSpan={a.laneSpan}
                          pxPerMin={pxPerMin}
                          frameStart={frameStart}
                          onClick={onOpenBooking}
                          onPeek={(b, ev) => setPeek({ x: ev.clientX, y: ev.clientY, booking: b })}
                          onPeekOut={() => setPeek(null)}
                        />
                      ))}

                      {/* NOW line (full height) */}
                      {showNow && (
                        <div
                          className="absolute inset-y-0 pointer-events-none z-[4]"
                          style={{ insetInlineStart: nowX, width: 2, background: "hsl(var(--brand))" }}
                          aria-hidden
                        />
                      )}

                      {/* Draft drag rectangle */}
                      {draft && draft.pitchId === pitch.id && (
                        <div
                          className="absolute rounded-[10px] pointer-events-none z-[5] flex items-center justify-center"
                          style={{
                            insetInlineStart: (draft.startMin - frameStart) * pxPerMin,
                            width: (draft.endMin - draft.startMin) * pxPerMin,
                            top: 4,
                            height: rowHeight - 8,
                            background: "hsl(var(--brand-tint))",
                            border: "2px dashed hsl(var(--brand))",
                          }}
                        >
                          <div className="text-[12px] font-bold text-[hsl(var(--brand-ink))]">
                            {fmtRange(draft.startMin, draft.endMin)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend + tip. Extra end-padding (pe-24) keeps the right-aligned tip
          clear of the global QuickActionFab (56px btn + 24px offset ≈ 80px). */}
      {!hideLegend && (
        <div className="flex flex-wrap items-center gap-4 ps-4 pe-24 py-3 border-t border-[hsl(var(--line))] bg-[hsl(var(--surface-2))]/40">
          {(["confirmed", "hold", "done", "issue"] as const).map((g) => {
            const color = colorFor(GROUP_META[g].color)
            return (
              <span
                key={g}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-[hsl(var(--ink-3))]"
              >
                <span
                  aria-hidden
                  className="inline-block"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 4,
                    background: color.tint,
                    border: `1.5px solid ${color.bg}`,
                  }}
                />
                {t(GROUP_TRANSLATION_KEY[g] as never)}
              </span>
            )
          })}
          {canManage && onCreate && (
            <span className="ms-auto text-[11.5px] text-[hsl(var(--ink-3))]">
              {t("drag_to_book")}
            </span>
          )}
        </div>
      )}

      {/* Hover peek */}
      {peek && <PeekCard x={peek.x} y={peek.y} booking={peek.booking} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// BookingBlock
// ---------------------------------------------------------------------------

function BookingBlock({
  booking,
  startMin,
  duration,
  topLane,
  laneSpan,
  pxPerMin,
  frameStart,
  onClick,
  onPeek,
  onPeekOut,
}: {
  booking: Booking
  startMin: number
  duration: number
  topLane: number
  laneSpan: number
  pxPerMin: number
  frameStart: number
  onClick?: (b: Booking) => void
  onPeek?: (b: Booking, ev: ReactMouseEvent) => void
  onPeekOut?: () => void
}) {
  const status = renderStatusFor(booking)
  const meta = STATUS_META[status]
  const color = colorFor(meta.color)
  const width = Math.max(20, duration * pxPerMin - 2)
  const height = laneSpan * LANE_H - 8
  const style: CSSProperties = {
    insetInlineStart: (startMin - frameStart) * pxPerMin,
    width,
    top: topLane * LANE_H + 4,
    height,
    background: color.tint,
    color: color.ink,
    borderInlineStart: `3px solid ${color.bg}`,
    borderRadius: 10,
  }
  const amount = booking.totalAmount ?? booking.amount
  const amountLabel =
    amount != null ? formatCurrency(amount).replace(" JOD", " JD") : ""
  return (
    <button
      type="button"
      data-booking-block
      className={cn(
        "absolute px-2.5 py-1.5 text-start overflow-hidden transition-shadow z-[2]",
        "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand))]/40",
        "hover:shadow-[var(--shadow-md)] flex flex-col justify-center gap-[1px]",
      )}
      style={style}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(booking)
      }}
      onMouseEnter={(e) => onPeek?.(booking, e)}
      onMouseMove={(e) => onPeek?.(booking, e)}
      onMouseLeave={() => onPeekOut?.()}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="truncate text-[12.5px] font-bold">
          {booking.player?.name ?? "—"}
        </span>
        {booking.pitchSize && (
          <span
            className="text-[9.5px] font-bold px-1 py-[1px] rounded-[4px] shrink-0 text-white"
            style={{ background: color.bg }}
          >
            {booking.pitchSize}v{booking.pitchSize}
          </span>
        )}
      </div>
      {height >= 26 && (
        <div className="mono text-[10.5px] opacity-75 truncate">
          {fmtRange(startMin, startMin + duration)}
          {amountLabel && ` · ${amountLabel}`}
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// PeekCard — floating hover tooltip
// ---------------------------------------------------------------------------

function PeekCard({ x, y, booking }: { x: number; y: number; booking: Booking }) {
  const { t, lang } = useT()
  const status = renderStatusFor(booking)
  const meta = STATUS_META[status]
  const start = parseHHMM(booking.startTime)
  const end = start + (booking.duration ?? 0)
  const amount = booking.totalAmount ?? booking.amount
  return (
    <div
      role="tooltip"
      className="fixed z-50 pointer-events-none rounded-[14px] bg-card border border-[hsl(var(--line))] shadow-lg-stadium p-3 w-[250px]"
      style={{ left: Math.min(x + 14, window.innerWidth - 270), top: Math.min(y + 14, window.innerHeight - 160) }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <Chip color={meta.color} dot size="sm">
          {t(`status_${status}` as never) ?? meta.label}
        </Chip>
        <span className="mono text-[10px] text-[hsl(var(--ink-3))]">
          #{booking.id.toUpperCase().slice(0, 8)}
        </span>
      </div>
      <div className="text-[14px] font-bold text-[hsl(var(--ink))] truncate">
        {booking.player?.name ?? "—"}
      </div>
      <div className="text-[12px] text-[hsl(var(--ink-2))] mt-0.5 mono">
        {fmtRange(start, end)} · {booking.duration ?? 0} {lang === "ar" ? "دقيقة" : "min"}
      </div>
      <div className="mt-2 pt-2 flex items-center justify-between text-[12px]"
        style={{ borderTop: "1px dashed hsl(var(--line))" }}
      >
        <span className="text-[hsl(var(--ink-3))]">{t("payment_method")}</span>
        <span className="font-semibold text-[hsl(var(--ink))]">
          {booking.paymentMethod ? `${booking.paymentMethod.toUpperCase()} · ` : ""}
          {amount != null ? formatCurrency(amount) : ""}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function sameYMD(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default LanesTimeline
