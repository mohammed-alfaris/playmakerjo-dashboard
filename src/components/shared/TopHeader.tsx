import { Menu, X, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { WeatherPill } from "./WeatherPill"
import { SearchTrigger } from "./SearchTrigger"
import { NotificationsBell } from "./NotificationsBell"
import { Breadcrumb } from "./Breadcrumb"

export function TopHeader({
  mobileOpen,
  isDark,
  onToggleDark,
  className,
}: {
  mobileOpen: boolean
  isDark: boolean
  onToggleDark: () => void
  className?: string
}) {
  const { t, lang, setLang } = useT()

  return (
    <header
      className={cn(
        "flex h-14 items-center gap-3 bg-card px-4",
        className
      )}
    >
      {/* Mobile hamburger */}
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </SheetTrigger>

      {/* Left: breadcrumb */}
      <div className="hidden md:block">
        <Breadcrumb />
      </div>

      {/* Center: ⌘K search */}
      <div className="flex-1 flex justify-center">
        <SearchTrigger />
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1">
        <WeatherPill className="mr-1" />
        <NotificationsBell />

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDark}
          title={isDark ? t("switch_to_light") : t("switch_to_dark")}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-sm font-semibold px-2 min-w-[2.5rem]"
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          title={lang === "en" ? "العربية" : "English"}
        >
          {lang === "en" ? "ع" : "EN"}
        </Button>
      </div>
    </header>
  )
}
