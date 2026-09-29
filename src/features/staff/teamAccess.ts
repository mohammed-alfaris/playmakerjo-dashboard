import { useQuery } from "@tanstack/react-query"
import { getStaffRoles, type StaffRole } from "@/api/staff"
import { getVenues, type Venue } from "@/api/venues"
import { useOwnerFilter } from "@/hooks/useRole"

export interface StaffAccessValue {
  staffRoleId: string
  allVenues: boolean
  venueIds: string[]
}

/**
 * A company's roles and venues — shared by the add and edit dialogs and the staff table.
 * Owners get their own company. An admin names the company with <c>companyId</c> (the owner's
 * user id) and nothing is fetched until one is picked.
 */
export function useTeamLookups(companyId?: string) {
  const ownerFilter = useOwnerFilter()
  const forAdmin = companyId !== undefined
  const roles = useQuery({
    queryKey: forAdmin ? ["staff-roles", companyId] : ["staff-roles"],
    queryFn: () => getStaffRoles(forAdmin ? companyId : undefined),
    enabled: !forAdmin || !!companyId,
  })
  // The API scopes /venues to the caller's company by itself; the owner filter only keeps
  // the mock honest and the cache key per identity.
  const venueFilter = forAdmin ? { owner_id: companyId } : ownerFilter
  const venues = useQuery({
    queryKey: ["team-venues", venueFilter],
    queryFn: () => getVenues({ limit: 100, ...venueFilter }) as Promise<{ data: Venue[] }>,
    enabled: !forAdmin || !!companyId,
  })
  return {
    roles: roles.data?.data ?? [],
    venues: venues.data?.data ?? [],
    isLoading: roles.isLoading || venues.isLoading,
  }
}

/**
 * The role a new clerk starts on: "View only", matching the server's default. A clerk who
 * cannot click something says so within the hour; a clerk silently given more says nothing.
 */
export function defaultRoleId(roles: StaffRole[]): string {
  return (roles.find((r) => r.name === "View only") ?? roles[0])?.id ?? ""
}


/** Client-side check before saving; the server repeats it and has the last word. */
export function validateAccess(value: StaffAccessValue): "role" | "venues" | null {
  if (!value.staffRoleId) return "role"
  if (!value.allVenues && value.venueIds.length === 0) return "venues"
  return null
}
