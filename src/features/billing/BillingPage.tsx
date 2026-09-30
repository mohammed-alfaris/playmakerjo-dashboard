import { useRole } from "@/hooks/useRole"
import AdminBillingPage from "./AdminBillingPage"
import OwnerBillingPage from "./OwnerBillingPage"

/** One route, two sides: the admin runs billing, the owner reads their own. */
export default function BillingPage() {
  const { isAdmin } = useRole()
  return isAdmin ? <AdminBillingPage /> : <OwnerBillingPage />
}
