import { Bell } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import api from "@/api/axios"

interface UnreadResponse {
  data: { unread_count: number }
}

function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      try {
        const res = await api.get<UnreadResponse>("/notifications/unread-count")
        return res.data?.data?.unread_count ?? 0
      } catch {
        return 0
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function NotificationsBell({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { data: count = 0 } = useUnreadCount()
  const hasUnread = count > 0

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate("/notifications")}
      className={cn("relative", className)}
    >
      <Bell className="h-4 w-4" />
      {hasUnread && (
        <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  )
}
