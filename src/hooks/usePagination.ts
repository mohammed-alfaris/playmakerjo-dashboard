import { useState } from "react"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"

export function usePagination(defaultLimit = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1)
  const [limit] = useState(defaultLimit)

  function resetPage() {
    setPage(1)
  }

  return { page, limit, setPage, resetPage }
}
