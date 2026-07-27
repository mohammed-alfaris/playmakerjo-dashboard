import { lazy, Suspense } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import AppLayout from "@/components/shared/AppLayout"
import { useAuthStore } from "@/store/authStore"

// Lazy-loaded pages
const LoginPage = lazy(() => import("@/features/auth/LoginPage"))
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"))
const VenuesPage = lazy(() => import("@/features/venues/VenuesPage"))
const VenueDetailPage = lazy(() => import("@/features/venues/VenueDetailPage"))
const UsersPage = lazy(() => import("@/features/users/UsersPage"))
const BookingsPage = lazy(() => import("@/features/bookings/BookingsPage"))
const PaymentsPage = lazy(() => import("@/features/payments/PaymentsPage"))
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"))
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage"))
const NotificationsPage = lazy(() => import("@/features/notifications/NotificationsPage"))
const ReviewsPage = lazy(() => import("@/features/reviews/ReviewsPage"))
const TimelinePage = lazy(() => import("@/features/timeline/TimelinePage"))
const MapPage = lazy(() => import("@/features/map/MapPage"))
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"))
const LeadsPage = lazy(() => import("@/features/leads/LeadsPage"))
const StaffPage = lazy(() => import("@/features/staff/StaffPage"))
const CustomersPage = lazy(() => import("@/features/customers/CustomersPage"))
const CustomerReportPage = lazy(() => import("@/features/customers/CustomerReportPage"))
const CustomerDetailPage = lazy(() => import("@/features/customers/CustomerDetailPage"))

function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Blocks venue_owner (and any other non-admin role) from admin-only pages */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== "super_admin") return <Navigate to="/" replace />
  return <>{children}</>
}

/**
 * Owner-only pages. Staff must not reach these — "My Team" is where an owner hires and
 * suspends people, so a clerk who could open it could promote themselves. The server
 * enforces the same rule; this only avoids showing a screen that would 403.
 */
function OwnerRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== "venue_owner") return <Navigate to="/" replace />
  return <>{children}</>
}

/**
 * The dashboard is entirely revenue and portfolio cards, all gated to admin/owner, so a
 * staff member landing on it saw a blank page. Send them to the schedule — the screen
 * they actually work in all day.
 */
function HomeRoute() {
  const user = useAuthStore((s) => s.user)
  if (user?.role === "venue_staff") return <Navigate to="/timeline" replace />
  return <LazyPage><DashboardPage /></LazyPage>
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicRoute>
        <LazyPage><LoginPage /></LazyPage>
      </PublicRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <HomeRoute /> },
      { path: "venues",     element: <LazyPage><VenuesPage /></LazyPage> },
      { path: "venues/:id", element: <LazyPage><VenueDetailPage /></LazyPage> },
      { path: "timeline",   element: <LazyPage><TimelinePage /></LazyPage> },
      { path: "map",        element: <AdminRoute><LazyPage><MapPage /></LazyPage></AdminRoute> },
      { path: "users",      element: <AdminRoute><LazyPage><UsersPage /></LazyPage></AdminRoute> },
      { path: "staff",      element: <OwnerRoute><LazyPage><StaffPage /></LazyPage></OwnerRoute> },
      // Staff reach this too — knowing who is on the phone is the counter clerk's job.
      { path: "customers",  element: <LazyPage><CustomersPage /></LazyPage> },
      { path: "customers/report", element: <LazyPage><CustomerReportPage /></LazyPage> },
      { path: "customers/:id", element: <LazyPage><CustomerDetailPage /></LazyPage> },
      { path: "bookings",   element: <LazyPage><BookingsPage /></LazyPage> },
      { path: "payments",   element: <LazyPage><PaymentsPage /></LazyPage> },
      { path: "reports",        element: <LazyPage><ReportsPage /></LazyPage> },
      { path: "notifications", element: <AdminRoute><LazyPage><NotificationsPage /></LazyPage></AdminRoute> },
      { path: "reviews",    element: <AdminRoute><LazyPage><ReviewsPage /></LazyPage></AdminRoute> },
      { path: "leads",      element: <AdminRoute><LazyPage><LeadsPage /></LazyPage></AdminRoute> },
      { path: "settings",   element: <AdminRoute><LazyPage><SettingsPage /></LazyPage></AdminRoute> },
      { path: "profile",    element: <LazyPage><ProfilePage /></LazyPage> },
      { path: "*",          element: <Navigate to="/" replace /> },
    ],
  },
])
