import { useAuthStore } from "@/store/authStore"

export function useRole() {
  const user = useAuthStore((s) => s.user)
  return {
    role:    user?.role ?? null,
    isAdmin: user?.role === "super_admin",
    isOwner: user?.role === "venue_owner",
    userId:  user?.id   ?? null,
  }
}

/**
 * Returns { owner_id: userId } when the logged-in user is a venue_owner,
 * or {} when they are a super_admin.
 * Spread this into any API call that supports owner scoping.
 *
 * @example
 * const ownerFilter = useOwnerFilter()
 * queryFn: () => getVenues({ page, limit, ...ownerFilter })
 */
export function useOwnerFilter(): { owner_id?: string } {
  const { isOwner, userId } = useRole()
  return isOwner && userId ? { owner_id: userId } : {}
}
