import api from "./axios"
import type { Booking } from "./bookings"

/**
 * Slots that already happened but nobody has ruled on — still sitting at "confirmed".
 *
 * Nothing in the system can observe attendance, so this is the only way no-show data ever
 * comes to exist. Everything returned here is assumed to have turned up; the owner marks
 * only the exceptions.
 */
export async function getPendingAttendance(days = 7): Promise<Booking[]> {
  const res = await api.get<{ data: Booking[] }>("/bookings/attendance-pending", {
    params: { days },
  })
  return res.data.data ?? []
}

/** "Everyone else turned up" — marks the given past bookings completed in one call. */
export async function confirmAttendance(bookingIds: string[]): Promise<{ confirmed: number }> {
  const res = await api.post<{ data: { confirmed: number } }>(
    "/bookings/attendance-confirm",
    { bookingIds },
  )
  return res.data.data
}
