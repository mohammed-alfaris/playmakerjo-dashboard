import type { QueryClient } from "@tanstack/react-query"

/**
 * Everything that shows a booking or its money. A move, a cancel or a refund changes what
 * all of these draw, and a screen left showing the old slot is how double bookings happen.
 */
export function refreshBookingViews(qc: QueryClient) {
  for (const key of ["timeline-bookings", "timeline-week", "venue-slots", "bookings", "payments", "payment-totals", "customers"]) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}
