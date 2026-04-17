import { LogOut } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { logout as logoutApi } from "@/api/auth"

export function UserCard({ collapsed }: { collapsed?: boolean }) {
  const navigate = useNavigate()
  const { user, logout: storeLogout } = useAuth()
  const { isOwner } = useRole()
  const { t } = useT()

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  async function handleLogout() {
    try {
      await logoutApi()
    } catch {
      // ignore
    } finally {
      storeLogout()
      navigate("/login")
    }
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 p-2">
        <button
          onClick={() => navigate("/profile")}
          title={user?.name ?? ""}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Avatar className="h-8 w-8">
            {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title={t("logout")}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 p-3")}>
      <button
        onClick={() => navigate("/profile")}
        className="flex flex-1 items-center gap-2 rounded-md p-1 transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Avatar className="h-8 w-8 shrink-0">
          {user?.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-left rtl:text-right">
          <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isOwner ? t("owner_badge") : t("role_super_admin")}
          </p>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        title={t("logout")}
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}
