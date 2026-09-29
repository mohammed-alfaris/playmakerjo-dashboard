import { useQuery } from "@tanstack/react-query"
import { getStaffRoles, type StaffRole } from "@/api/staff"
import { getVenues, type Venue } from "@/api/venues"
import { useOwnerFilter } from "@/hooks/useRole"

export interface StaffAccessValue {
  staffRoleId: string
  allVenues: boolean
  venueIds: string[]
}

/** The owner's roles and venues — shared by the add and edit dialogs and the staff table. */
export function useTeamLookups() {
  const roles = useQuery({
    queryKey: ["staff-roles"],
    queryFn: getStaffRoles,
  })
  // The API scopes /venues to the caller's company by itself; the owner filter only keeps
  // the mock honest and the cache key per identity.
  const ownerFilter = useOwnerFilter()
  const venues = useQuery({
    queryKey: ["team-venues", ownerFilter],
    queryFn: () => getVenues({ limit: 100, ...ownerFilter }) as Promise<{ data: Venue[] }>,
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
