import type { InboxItem } from "@/api/notifications"

/**
 * The server stores notification text bilingual, "English|Arabic" (NotificationService.Bi).
 * Pick the reader's half; text without a separator is the same in both.
 */
export function localized(text: string, lang: "en" | "ar"): string {
  const i = text.indexOf("|")
  if (i < 0) return text
  return (lang === "ar" ? text.slice(i + 1) : text.slice(0, i)).trim()
}

/** Types that mean "the schedule changed" — they refresh the timeline and ring. */
export const SCHEDULE_EVENTS = new Set(["new_booking", "new_series", "proof_received", "booking_cancelled", "series_cancelled"])

export type InboxTarget =
  | { kind: "booking"; bookingId: string }
  | { kind: "proof"; bookingId: string }
  | { kind: "route"; path: string }
  | { kind: "none" }

/** Where tapping a notification takes you. */
export function targetOf(item: Pick<InboxItem, "type" | "referenceId">): InboxTarget {
  if (item.type === "venue_lead") return { kind: "route", path: "/leads" }
  if (item.type === "invoice_issued") return { kind: "route", path: "/billing" }
  if (!item.referenceId) return { kind: "none" }
  if (item.type === "proof_received" || item.type === "proof_waiting") return { kind: "proof", bookingId: item.referenceId }
  // A weekly series is referenced by its series id, not a booking's.
  if (item.type === "series_cancelled") return { kind: "route", path: "/bookings" }
  // A review is referenced by the venue it is about.
  if (item.type === "new_review") return { kind: "route", path: `/venues/${item.referenceId}` }
  if (item.type.startsWith("booking_") || item.type === "new_booking" || item.type === "new_series" || item.type === "no_show")
    return { kind: "booking", bookingId: item.referenceId }
  return { kind: "none" }
}

/**
 * The notifications to announce after a refresh: unread, not seen in any earlier poll, and
 * newer than when this page opened — so a stack of old unread items does not all ring at
 * once on login, and each new one rings exactly once.
 */
export function freshArrivals(items: InboxItem[], seen: ReadonlySet<string>, openedAt: number): InboxItem[] {
  return items.filter((n) => !n.isRead && !seen.has(n.id) && Date.parse(n.createdAt) >= openedAt)
}

/** "just now", "5m", "3h", "2d" — short enough for a narrow list. */
export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return "now"
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
