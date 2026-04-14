import { useState, useEffect } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  MapPin,
  Users,
  CalendarCheck,
  CreditCard,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useRole } from "@/hooks/useRole"
import { logout } from "@/api/auth"
import { Toaster } from "@/components/ui/sonner"
import { Badge } from "@/components/ui/badge"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"

// ─── Nav structure ────────────────────────────────────────────────────────────

type NavItem = {
  href: string
  labelKey: TranslationKey
  icon: React.ElementType
  roles: string[]
}

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
      { href: "/users",    labelKey: "nav_users",    icon: Users,    roles: ["super_admin"] },
      { href: "/payments", labelKey: "nav_payments", icon: CreditCard, roles: ["super_admin"] },
      { href: "/reports",       labelKey: "nav_reports",       icon: BarChart3,  roles: ["super_admin", "venue_owner"] },
      { href: "/notifications", labelKey: "nav_notifications", icon: Bell,       roles: ["super_admin"] },
    ],
  },
]

// ─── NavLink ──────────────────────────────────────────────────────────────────

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
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href))

  return (
    <Link
      to={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-brand/10 text-brand font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-brand before:rounded-full"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}

// ─── SidebarContent ───────────────────────────────────────────────────────────

function SidebarContent({
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
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn("flex h-14 items-center border-b px-4 shrink-0", collapsed && "justify-center px-2")}>
        {collapsed ? (
          <span className="text-lg font-bold font-display">SV</span>
        ) : (
          <span className="text-lg font-bold tracking-tight font-display">Sports Venue</span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role ?? ""))
          if (!visibleItems.length) return null
          return (
            <div key={group.labelKey ?? "main"} className="space-y-0.5">
              {group.labelKey && !collapsed && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {t(group.labelKey)}
                </p>
              )}
              {visibleItems.map((item) => (
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

      {/* Footer: collapse toggle — desktop only */}
      {showCollapseToggle && onToggleCollapse && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-muted-foreground/50 hover:text-muted-foreground"
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    localStorage.getItem("sidebar-collapsed") === "true"
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout: storeLogout } = useAuth()
  const { isOwner } = useRole()
  const { t, lang, setLang } = useT()

  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem("theme")
    return stored ? stored === "dark" : true
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [isDark])

  function toggleCollapse() {
    setSidebarCollapsed((v) => {
      const next = !v
      localStorage.setItem("sidebar-collapsed", String(next))
      return next
    })
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // ignore
    } finally {
      storeLogout()
      navigate("/login")
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "SA"

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-card transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-56"
        )}
      >
        <SidebarContent
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleCollapse}
          showCollapseToggle
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            onLinkClick={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4">
          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
          </Sheet>

          <div className="flex-1" />

          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark((v) => !v)}
            title={isDark ? t("switch_to_light") : t("switch_to_dark")}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Language toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="text-sm font-semibold px-2 min-w-[2.5rem]"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            title={lang === "en" ? "العربية" : "English"}
          >
            {lang === "en" ? "ع" : "EN"}
          </Button>

          {/* User menu (header) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-7 w-7">
                  {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                {isOwner && (
                  <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
                    {t("owner_badge")}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate("/profile")}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t("nav_profile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <Separator />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  )
}
