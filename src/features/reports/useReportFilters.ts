import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import type { ReportParams } from "@/api/reports"
import { readFilters, writeFilters, type ReportFilters } from "./reportLogic"

/**
 * The report filters live in the URL, so a view can be bookmarked, shared with an accountant,
 * refreshed, and printed with exactly the same numbers.
 */
export function useReportFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readFilters(searchParams), [searchParams])

  const update = useCallback(
    (patch: Partial<ReportFilters>) => setSearchParams(writeFilters({ ...filters, ...patch }), { replace: true }),
    [filters, setSearchParams],
  )

  const params: ReportParams = useMemo(() => ({
    from: filters.from,
    to: filters.to,
    venue_id: filters.venue || undefined,
    owner_id: filters.company || undefined,
    compare: filters.compare,
  }), [filters])

  return { filters, update, params, searchParams }
}
