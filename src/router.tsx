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
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      { path: "venues",     element: <LazyPage><VenuesPage /></LazyPage> },
      { path: "venues/:id", element: <LazyPage><VenueDetailPage /></LazyPage> },
      { path: "users",      element: <AdminRoute><LazyPage><UsersPage /></LazyPage></AdminRoute> },
      { path: "bookings",   element: <LazyPage><BookingsPage /></LazyPage> },
      { path: "payments",   element: <AdminRoute><LazyPage><PaymentsPage /></LazyPage></AdminRoute> },
      { path: "reports",        element: <LazyPage><ReportsPage /></LazyPage> },
      { path: "notifications", element: <AdminRoute><LazyPage><NotificationsPage /></LazyPage></AdminRoute> },
      { path: "reviews",    element: <AdminRoute><LazyPage><ReviewsPage /></LazyPage></AdminRoute> },
      { path: "profile",    element: <LazyPage><ProfilePage /></LazyPage> },
      { path: "*",          element: <Navigate to="/" replace /> },
    ],
  },
])
