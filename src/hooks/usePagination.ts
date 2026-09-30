import { useCallback, useState } from "react"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"

export function usePagination(defaultLimit = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const [limit] = useState(defaultLimit)

  // Must be referentially stable. VenuesPage and UsersPage list `resetPage` in a
  // useEffect dependency array behind a 400ms debounce; an unmemoised function
  // gets a new identity every render, so the effect re-armed continuously and
  // fired setPage(1) about 400ms after the list settled — making it impossible
  // to stay on page 2 of the venue or user lists. `setPage` from useState is
  // already stable, so the empty dep array is correct.
  const resetPage = useCallback(() => setPage(1), [])

  return { page, limit, setPage, resetPage }
}
