import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { useCommandPaletteStore } from "@/store/commandPaletteStore"

/**
 * Visual trigger for the ⌘K command palette. Palette opens on click or Cmd/Ctrl+K.
 */
export function SearchTrigger({ className }: { className?: string }) {
  const { t } = useT()
  const open = useCommandPaletteStore((s) => s.setOpen)

  return (
    <button
      type="button"
      onClick={() => open(true)}
      className={cn(
        "group hidden md:inline-flex h-9 min-w-[16rem] items-center gap-2 rounded-lg bg-muted/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left rtl:text-right">{t("search_placeholder")}</span>
      <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  )
}
