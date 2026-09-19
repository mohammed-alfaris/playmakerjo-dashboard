import { useAuthStore } from "@/store/authStore"

export function useRole() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "super_admin"
  const isOwner = user?.role === "venue_owner"
  const isStaff = user?.role === "venue_staff"
  const staffPermission = isStaff ? (user?.permissions ?? "read") : null

  return {
    role:    user?.role ?? null,
    isAdmin,
    isOwner,
    isStaff,
    /** "read" | "write" for staff, null otherwise. */
    staffPermission,
    /**
     * May this user change bookings? Staff need "write"; a read-only clerk sees the
     * schedule but gets no action buttons. This is UI courtesy only — the server
     * enforces the same rule and is the thing that actually decides.
     */
    canWrite: isAdmin || isOwner || staffPermission === "write",
    userId:  user?.id   ?? null,
  }
}

/**
 * Returns { owner_id: userId } for a venue_owner, {} otherwise.
 *
 * IMPORTANT: this is no longer a security boundary and must not be treated as one.
 * The API now derives scope from the JWT and deliberately IGNORES a client-supplied
 * owner_id for owners and staff — sending it from here cannot widen what comes back.
 * It is kept only so admin-facing screens can narrow to one owner, and so the query
 * key changes when the identity does.
 *
 * @example
 * const ownerFilter = useOwnerFilter()
 * queryFn: () => getVenues({ page, limit, ...ownerFilter })
 */
export function useOwnerFilter(): { owner_id?: string } {
  const { isOwner, userId } = useRole()
  return isOwner && userId ? { owner_id: userId } : {}
}
