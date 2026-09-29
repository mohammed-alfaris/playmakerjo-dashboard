import { useRole } from "@/hooks/useRole"
import type { ReportTab } from "./reportLogic"

/**
 * The tabs this viewer gets. Platform is the admin's whole-platform view; Customers & team is
 * hidden from a clerk who may see neither (customers need customers.view, the team section is
 * owner/admin only). The server enforces all of it again.
 */
export function useVisibleTabs(company: string): ReportTab[] {
  const { isAdmin, isOwner, can } = useRole()
  const tabs: ReportTab[] = []
  if (isAdmin && !company) tabs.push("platform")
  tabs.push("money", "busy", "bookings")
  if (isAdmin || isOwner || can("customers.view")) tabs.push("customers")
  return tabs
}
