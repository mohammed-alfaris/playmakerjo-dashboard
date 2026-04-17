import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  MapPin,
  Users,
  CalendarCheck,
  CreditCard,
  BarChart3,
  Bell,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { UserCard } from "./UserCard"

type NavItem = {
  href: string
  labelKey: TranslationKey
  icon: React.ElementType
  roles: string[]
}

// /schedule and /announcements entries deferred until Phases 9 + 11 ship the routes.
const NAV_GROUPS: { labelKey: TranslationKey | null; items: NavItem[] }[] = [
  {
    labelKey: null,
    items: [
      { href: "/",         labelKey: "nav_dashboard", icon: LayoutDashboard, roles: ["super_admin", "venue_owner"] },
      { href: "/venues",   labelKey: "nav_venues",    icon: MapPin,          roles: ["super_admin", "venue_owner"] },
      { href: "/bookings", labelKey: "nav_bookings",  icon: CalendarCheck,   roles: ["super_admin", "venue_owner"] },
    ],
  },
  {
    labelKey: "nav_management",
    items: [
      { href: "/users",         labelKey: "nav_users",         icon: Users,       roles: ["super_admin"] },
      { href: "/payments",      labelKey: "nav_payments",      icon: CreditCard,  roles: ["super_admin"] },
      { href: "/reports",       labelKey: "nav_reports",       icon: BarChart3,   roles: ["super_admin", "venue_owner"] },
      { href: "/reviews",       labelKey: "reviews",           icon: Star,        roles: ["super_admin"] },
      { href: "/notifications", labelKey: "nav_notifications", icon: Bell,        roles: ["super_admin"] },
    ],
  },
]

function NavLink({
  href,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: {
  href: string
  label: string
  icon: React.ElementType
  collapsed?: boolean
  onClick?: () => void
}) {
  const { pathname } = useLocation()
  const isActive = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      to={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ease-kinetic",
        isActive
          ? "bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:bg-primary before:rounded-full rtl:before:left-auto rtl:before:right-0"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

export function Sidebar({
  collapsed,
  onLinkClick,
  onToggleCollapse,
  showCollapseToggle,
}: {
  collapsed?: boolean
  onLinkClick?: () => void
  onToggleCollapse?: () => void
  showCollapseToggle?: boolean
}) {
  const { role } = useRole()
  const { t } = useT()

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center px-4 shrink-0",
          collapsed && "justify-center px-2"
        )}
      >
        {collapsed ? (
          <span className="text-lg font-semibold font-display text-primary">PM</span>
        ) : (
          <span className="text-lg font-semibold tracking-tight font-display text-foreground">
            PlayMaker <span className="text-primary">JO</span>
          </span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_GROUPS.map((group, idx) => {
          const visible = group.items.filter((it) => it.roles.includes(role ?? ""))
          if (!visible.length) return null
          return (
            <div key={group.labelKey ?? `main-${idx}`} className="space-y-0.5">
              {group.labelKey && !collapsed && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {t(group.labelKey)}
                </p>
              )}
              {visible.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={t(item.labelKey)}
                  icon={item.icon}
                  collapsed={collapsed}
                  onClick={onLinkClick}
                />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer: user card + collapse toggle */}
      <div className="shrink-0">
        <UserCard collapsed={collapsed} />
        {showCollapseToggle && onToggleCollapse && (
          <div className="px-2 pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-7 text-muted-foreground/50 hover:text-muted-foreground"
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
