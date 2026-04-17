import { Link, useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"

const ROUTE_LABELS: Record<string, TranslationKey> = {
  "/":              "nav_dashboard",
  "/venues":        "nav_venues",
  "/bookings":      "nav_bookings",
  "/users":         "nav_users",
  "/payments":      "nav_payments",
  "/reports":       "nav_reports",
  "/reviews":       "reviews",
  "/notifications": "nav_notifications",
  "/profile":       "nav_profile",
}

export function Breadcrumb({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const { t } = useT()

  if (pathname === "/") {
    return (
      <h1 className={cn("text-sm font-medium text-foreground", className)}>
        {t("nav_dashboard")}
      </h1>
    )
  }

  const segments = pathname.split("/").filter(Boolean)
  const crumbs: { href: string; label: string }[] = []
  let acc = ""
  for (const seg of segments) {
    acc += "/" + seg
    const key = ROUTE_LABELS[acc]
    crumbs.push({ href: acc, label: key ? t(key) : seg })
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}
    >
      <Link to="/" className="hover:text-foreground transition-colors">
        {t("nav_dashboard")}
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : (
            <Link to={c.href} className="hover:text-foreground transition-colors">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
