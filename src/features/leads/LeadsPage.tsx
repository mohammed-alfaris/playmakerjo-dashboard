import { useState } from "react"
import { Users, Building2 } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { PlayerLeadsTable } from "./PlayerLeadsTable"
import { VenueLeadsTable } from "./VenueLeadsTable"

type Tab = "players" | "venues"

export default function LeadsPage() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>("players")

  return (
    <div className="space-y-6">
      <PageHeader title={t("leads")} subtitle={t("leads_subtitle")} />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <TabButton active={tab === "players"} onClick={() => setTab("players")}>
          <Users className="h-4 w-4" />
          {t("leads_players_tab")}
        </TabButton>
        <TabButton active={tab === "venues"} onClick={() => setTab("venues")}>
          <Building2 className="h-4 w-4" />
          {t("leads_venues_tab")}
        </TabButton>
      </div>

      {tab === "players" ? <PlayerLeadsTable /> : <VenueLeadsTable />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-none border-b-2 -mb-px gap-2 text-sm",
        active
          ? "border-primary text-primary hover:text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Button>
  )
}
