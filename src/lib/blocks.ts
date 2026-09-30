import type { VenueBlock } from "@/api/blocks"

/** Minutes since the epoch for a naive "yyyy-MM-dd[THH:mm]" wall-clock time. No time zones: both sides are Amman time. */
function naiveMinutes(s: string): number {
  const [d, t = "00:00"] = s.split("T")
  const [y, mo, day] = d.split("-").map(Number)
  const [h, mi] = t.split(":").map(Number)
  return Date.UTC(y, mo - 1, day, h || 0, mi || 0) / 60_000
}

/** Does this block close this pitch? A block with no pitch closes every pitch. */
export function blockCovers(block: VenueBlock, pitchId: string | null | undefined): boolean {
  return block.pitchId == null || block.pitchId === pitchId
}

/**
 * Where a block falls on an operating day, as minutes from that day's midnight — the same
 * axis the lanes use, including a late window's minutes past 24:00. Clipped to [0, 48h).
 * Null when it does not touch the day.
 */
export function blockMinutesOn(block: VenueBlock, isoDate: string): { from: number; to: number } | null {
  const dayStart = naiveMinutes(isoDate.slice(0, 10))
  const from = Math.max(0, naiveMinutes(block.startsAt) - dayStart)
  const to = Math.min(48 * 60, naiveMinutes(block.endsAt) - dayStart)
  return to > from ? { from, to } : null
}

/** This pitch's blocked spans on the day, in lane minutes. */
export function blockSpansFor(
  blocks: VenueBlock[] | undefined,
  pitchId: string,
  isoDate: string,
): { block: VenueBlock; from: number; to: number }[] {
  const out: { block: VenueBlock; from: number; to: number }[] = []
  for (const b of blocks ?? []) {
    if (!blockCovers(b, pitchId)) continue
    const m = blockMinutesOn(b, isoDate)
    if (m) out.push({ block: b, ...m })
  }
  return out.sort((a, b) => a.from - b.from)
}

/** The blocks that touch a calendar day at all — for the week view's day columns. */
export function blocksOnDay(blocks: VenueBlock[] | undefined, isoDate: string): VenueBlock[] {
  return (blocks ?? []).filter((b) => {
    const m = blockMinutesOn(b, isoDate)
    return m != null && m.from < 24 * 60
  })
}
