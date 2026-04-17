import { useEffect, useState } from "react"
import { Command } from "cmdk"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  LayoutDashboard,
  MapPin,
  CalendarCheck,
  Users,
  CreditCard,
  BarChart3,
  Bell,
  Building2,
  UserPlus,
  FileDown,
  Megaphone,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { useCommandPaletteStore } from "@/store/commandPaletteStore"
import { getVenues, type Venue } from "@/api/venues"
import type { TranslationKey } from "@/i18n/translations"

interface PageItem {
  href: string
  labelKey: TranslationKey
  icon: React.ElementType
  adminOnly?: boolean
}
const PAGES: PageItem[] = [
  { href: "/",              labelKey: "nav_dashboard",     icon: LayoutDashboard },
  { href: "/venues",        labelKey: "nav_venues",        icon: MapPin },
  { href: "/bookings",      labelKey: "nav_bookings",      icon: CalendarCheck },
  { href: "/users",         labelKey: "nav_users",         icon: Users,       adminOnly: true },
  { href: "/payments",      labelKey: "nav_payments",      icon: CreditCard,  adminOnly: true },
  { href: "/reports",       labelKey: "nav_reports",       icon: BarChart3 },
  { href: "/notifications", labelKey: "nav_notifications", icon: Bell,        adminOnly: true },
]

interface QuickAction {
  id: string
  labelKey: TranslationKey
  icon: React.ElementType
  run: (nav: ReturnType<typeof useNavigate>) => void
  adminOnly?: boolean
}
const QUICK_ACTIONS: QuickAction[] = [
  { id: "add-venue",  labelKey: "add_venue",              icon: Building2, run: (n) => n("/venues?new=1") },
  { id: "add-user",   labelKey: "add_user",               icon: UserPlus,  run: (n) => n("/users?new=1"),         adminOnly: true },
  { id: "broadcast",  labelKey: "broadcast_announcement", icon: Megaphone, run: (n) => n("/notifications?new=1"), adminOnly: true },
  { id: "export",     labelKey: "export_report",          icon: FileDown,  run: (n) => n("/reports?export=1") },
]

export function CommandPalette() {
  const { open, setOpen } = useCommandPaletteStore()
  const navigate = useNavigate()
  const { isAdmin } = useRole()
  const { t } = useT()
  const [query, setQuery] = useState("")

  // Global keybinding: Cmd+K / Ctrl+K toggles
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, setOpen])

  // Reset query when closing
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  // Venue search — only when query is non-empty
  const { data: venueResults } = useQuery({
    queryKey: ["command-palette", "venues", query],
    queryFn: async () => {
      if (!query.trim()) return { data: [] }
      return getVenues({ search: query, page: 1, limit: 5 })
    },
    enabled: open && query.trim().length > 0,
    staleTime: 10_000,
  })

  function runAndClose(fn: () => void) {
    fn()
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Palette */}
      <Command
        label={t("search_placeholder")}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-ambient",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder={t("search_placeholder")}
            className="flex h-12 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            {t("no_results")}
          </Command.Empty>

          <Command.Group
            heading={t("quick_actions")}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin).map((a) => (
              <Command.Item
                key={a.id}
                value={`action ${t(a.labelKey)}`}
                onSelect={() => runAndClose(() => a.run(navigate))}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer aria-selected:bg-muted"
              >
                <a.icon className="h-4 w-4 text-primary" />
                <span>{t(a.labelKey)}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            heading={t("pages")}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {PAGES.filter((p) => !p.adminOnly || isAdmin).map((p) => (
              <Command.Item
                key={p.href}
                value={`page ${t(p.labelKey)}`}
                onSelect={() => runAndClose(() => navigate(p.href))}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer aria-selected:bg-muted"
              >
                <p.icon className="h-4 w-4 text-muted-foreground" />
                <span>{t(p.labelKey)}</span>
                <span className="ml-auto rtl:ml-0 rtl:mr-auto text-[10px] text-muted-foreground/70">
                  {p.href}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          {venueResults?.data && venueResults.data.length > 0 && (
            <Command.Group
              heading={t("nav_venues")}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {venueResults.data.slice(0, 5).map((v: Venue) => (
                <Command.Item
                  key={v.id}
                  value={`venue ${v.name} ${v.city}`}
                  onSelect={() => runAndClose(() => navigate(`/venues/${v.id}`))}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-pointer aria-selected:bg-muted"
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground">{v.city}</span>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  )
}
