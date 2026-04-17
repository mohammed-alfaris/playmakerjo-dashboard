import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Plus, Building2, UserPlus, Megaphone, FileDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"

interface Action {
  labelKey: TranslationKey
  icon: React.ElementType
  onClick: () => void
  adminOnly?: boolean
}

export function QuickActionFab() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { isAdmin } = useRole()
  const { t } = useT()

  const actions: Action[] = [
    { labelKey: "add_venue",              icon: Building2, onClick: () => navigate("/venues?new=1") },
    { labelKey: "add_user",               icon: UserPlus,  onClick: () => navigate("/users?new=1"),       adminOnly: true },
    { labelKey: "broadcast_announcement", icon: Megaphone, onClick: () => navigate("/notifications?new=1"), adminOnly: true },
    { labelKey: "export_report",          icon: FileDown,  onClick: () => navigate("/reports?export=1") },
  ]
  const visible = actions.filter((a) => !a.adminOnly || isAdmin)

  return (
    <div className="fixed bottom-6 right-6 rtl:right-auto rtl:left-6 z-40 flex flex-col items-end rtl:items-start gap-2">
      <AnimatePresence>
        {open &&
          visible.map((a, i) => (
            <motion.button
              key={a.labelKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.18 } }}
              exit={{ opacity: 0, y: 12, transition: { duration: 0.12 } }}
              onClick={() => {
                a.onClick()
                setOpen(false)
              }}
              className={cn(
                "group flex items-center gap-3 rounded-full bg-card shadow-ambient px-4 py-2.5 text-sm font-medium text-foreground",
                "hover:bg-muted/60 transition-colors"
              )}
            >
              <a.icon className="h-4 w-4 text-primary" />
              <span>{t(a.labelKey)}</span>
            </motion.button>
          ))}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-ambient",
          "bg-primary-gradient transition-transform duration-200 ease-kinetic",
          open && "rotate-45"
        )}
        aria-label={t("quick_actions")}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </motion.button>
    </div>
  )
}
