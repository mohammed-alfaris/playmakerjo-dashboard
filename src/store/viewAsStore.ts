import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

interface ViewAsState {
  /** The company an admin is looking at the dashboard as; null = the whole platform. */
  companyId: string | null
  companyName: string | null
  viewAs: (companyId: string, companyName: string) => void
  exit: () => void
}

/**
 * "View as company" for the admin. The pages that scope to a company (dashboard, venues,
 * timeline, bookings, reports) read it through useOwnerFilter, so the admin sees exactly the
 * numbers and schedule that owner sees. It narrows what is shown; it grants nothing — the
 * admin keeps their own account and permissions throughout.
 *
 * Per tab (sessionStorage), so a second tab can stay on the whole platform.
 */
export const useViewAsStore = create<ViewAsState>()(
  persist(
    (set) => ({
      companyId: null,
      companyName: null,
      viewAs: (companyId, companyName) => set({ companyId, companyName }),
      exit: () => set({ companyId: null, companyName: null }),
    }),
    { name: "view-as", storage: createJSONStorage(() => sessionStorage) },
  ),
)
