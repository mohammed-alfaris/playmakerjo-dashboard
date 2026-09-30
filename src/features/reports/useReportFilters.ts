import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import type { ReportParams } from "@/api/reports"
import { useViewAsStore } from "@/store/viewAsStore"
import { readFilters, writeFilters, type ReportFilters } from "./reportLogic"

/**
 * The report filters live in the URL, so a view can be bookmarked, shared with an accountant,
 * refreshed, and printed with exactly the same numbers.
 */
export function useReportFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const viewAs = useViewAsStore((s) => s.companyId)

  const update = useCallback(
    (patch: Partial<ReportFilters>) => setSearchParams(writeFilters({ ...filters, ...patch }), { replace: true }),
    [filters, setSearchParams],
  )

  const params: ReportParams = useMemo(() => ({
    from: filters.from,
    to: filters.to,
    venue_id: filters.venue || undefined,
    // An admin viewing as a company reports on that company unless they picked another.
    owner_id: filters.company || viewAs || undefined,
    compare: filters.compare,
  }), [filters, viewAs])

  return { filters, update, params, searchParams }
}
