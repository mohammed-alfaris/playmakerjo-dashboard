import { useQuery } from "@tanstack/react-query"
import { getMyCompany } from "@/api/companies"
import { useRole } from "./useRole"

/**
 * The signed-in owner's company and usage. Only owners ask — staff and admins get null.
 * Invalidate ["company"] after anything that adds or removes a venue or a team member.
 */
export function useMyCompany() {
  const { isOwner, userId } = useRole()
  const { data } = useQuery({
    queryKey: ["company", "me", userId],
    queryFn: getMyCompany,
    enabled: isOwner,
    staleTime: 30_000,
  })
  return isOwner ? (data?.data ?? null) : null
}
