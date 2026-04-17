import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/hooks/useSidebar"
import { Sidebar } from "./Sidebar"
import { TopHeader } from "./TopHeader"
import { QuickActionFab } from "./QuickActionFab"
import { AnnouncementsBanner } from "./AnnouncementsBanner"

export default function AppLayout() {
  const { collapsed, toggle } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("theme") : null
    return stored ? stored === "dark" : true
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add("dark")
      window.localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      window.localStorage.setItem("theme", "light")
    }
  }, [isDark])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col transition-[width] duration-200 ease-kinetic",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={toggle}
          showCollapseToggle
        />
      </aside>

      {/* Sheet wrapper — SheetTrigger lives in TopHeader; SheetContent is the mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          <TopHeader
            mobileOpen={mobileOpen}
            isDark={isDark}
            onToggleDark={() => setIsDark((v) => !v)}
          />

          <AnnouncementsBanner />

          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>

        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar onLinkClick={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <QuickActionFab />
      <Toaster richColors position="top-right" />
    </div>
  )
}
