/**
 * The minimum a booking-like object must carry to be named. Deliberately structural rather
 * than the full Booking type: the dashboard's activity feed and the recent-bookings table
 * each redeclare their own narrower shape, and forcing them to import Booking would be a
 * bigger change than this fix warrants.
 */
export interface NameableBooking {
  customer?: { name: string; phone: string } | null
  player?: { name: string } | null
  notes?: string | null
  isManual?: boolean
}

/**
 * Who is this booking for?
 *
 * A manual booking stores `PlayerId = the owner's own id`, so falling straight back to
 * `player.name` prints the OWNER'S name on every walk-in — the schedule reads as the owner
 * booking his own pitch eight times on a Thursday evening. That is the display bug the
 * customer record exists to end.
 *
 * Resolution order:
 *   1. the customer record — everything captured from now on
 *   2. the legacy "Walk-in: {name}." fragment inside notes — the ONLY place the name lives
 *      on manual bookings taken before customer records existed. Dropping this step would
 *      retroactively apply the very bug we are fixing to all historical rows.
 *   3. the player, for genuine app bookings
 *   4. a neutral label — never a name we are not sure of
 */
const LEGACY_WALK_IN = /Walk-in:\s*(.+?)\./

export function bookingPersonName(b: NameableBooking, walkInFallback: string): string {
  if (b.customer?.name) return b.customer.name

  const legacy = b.notes?.match(LEGACY_WALK_IN)?.[1]?.trim()
  if (legacy) return legacy

  // A manual booking with no customer and no legacy name would otherwise show the owner.
  if (b.isManual) return walkInFallback

  return b.player?.name || walkInFallback
}

/** The customer's phone, when we have one. Manual bookings only. */
export function bookingPersonPhone(b: NameableBooking): string | null {
  return b.customer?.phone ?? null
}
