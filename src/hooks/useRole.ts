import { useCallback } from "react"
import { useAuthStore } from "@/store/authStore"
import { legacyPermissions, type Permission } from "@/lib/permissions"

export function useRole() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === "super_admin"
  const isOwner = user?.role === "venue_owner"
  const isStaff = user?.role === "venue_staff"

  // Staff: their role's list from /users/me. Until that answers, the old read/write level
  // stands in — it is exactly what the role was migrated from, so nothing flickers.
  const staffPermissions: readonly string[] | null = isStaff
    ? (user?.access?.permissions ?? legacyPermissions(user?.permissions))
    : null

  /**
   * May this user do `permission`? Owners and admins may do everything; staff what their
   * role grants. UI courtesy only — the server checks the same thing on every request and
   * is what actually decides.
   */
  const can = useCallback(
    (permission: Permission) =>
      isAdmin || isOwner || (staffPermissions?.includes(permission) ?? false),
    [isAdmin, isOwner, staffPermissions],
  )

  return {
    role:    user?.role ?? null,
    isAdmin,
    isOwner,
    isStaff,
    can,
    /** Staff only: the name of their role, e.g. "Front desk". */
    staffRoleName: isStaff ? (user?.access?.staffRole?.name ?? null) : null,
    /** Staff only: null = every venue of the company, otherwise the venues they work at. */
    venueScope: isStaff && user?.access && !user.access.allVenues ? user.access.venueIds : null,
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
