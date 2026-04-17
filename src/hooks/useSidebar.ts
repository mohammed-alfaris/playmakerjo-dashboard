import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "sidebar-collapsed"

/**
 * Owns the sidebar collapsed state and persists it to localStorage.
 */
export function useSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(STORAGE_KEY) === "true"
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((v) => !v), [])
  const collapse = useCallback(() => setCollapsed(true), [])
  const expand = useCallback(() => setCollapsed(false), [])

  return { collapsed, toggle, collapse, expand }
}
