import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { getMe } from "@/api/users"
import type { AccessSummary, AuthUser } from "@/api/auth"
import { useAuthStore } from "@/store/authStore"

/**
 * Keeps the signed-in user's access current without a re-login.
 *
 * The login response carries who you are, not what your role lets you do, and an owner can
 * change a clerk's role or venues at any moment. So the layout asks /users/me on load and
 * whenever the window regains focus, and folds the answer into the stored user — the
 * sidebar and buttons then follow the server's current view. The server enforces the
 * same rules on every request either way; this only stops the UI offering what would 403.
 */
export function useSessionRefresh() {
  const userId = useAuthStore((s) => s.user?.id)
  const updateUser = useAuthStore((s) => s.updateUser)

  const { data } = useQuery({
    queryKey: ["me", userId],
    queryFn: () => getMe() as Promise<{ data: AuthUser & { access?: AccessSummary } }>,
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const me = data?.data
    if (!me || me.id !== userId) return
    updateUser({
      name: me.name,
      role: me.role,
      avatar: me.avatar,
      permissions: me.permissions,
      access: me.access,
    })
  }, [data, userId, updateUser])
}
