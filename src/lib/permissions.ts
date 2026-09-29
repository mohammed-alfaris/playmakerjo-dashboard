import type { TranslationKey } from "@/i18n/translations"

/**
 * The staff permission catalog, mirrored from the API's Constants/StaffPermissions.cs.
 *
 * Kept as a fixed list here rather than fetched: every key needs a translated label and a
 * place in the role editor, so a key the dashboard does not know about could not be shown
 * sensibly anyway. The server validates every key it is sent.
 */
export const PERMISSIONS = [
  "bookings.view",
  "bookings.manage",
  "payments.view",
  "payments.record",
  "customers.view",
  "customers.export",
  "customers.manage",
  "standing.view",
  "standing.manage",
  "reports.view",
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Translation key for a permission's label: "bookings.manage" → "perm_bookings_manage". */
export function permissionLabelKey(p: Permission): TranslationKey {
  return `perm_${p.replace(".", "_")}` as TranslationKey
}

export type PermissionGroup = "bookings" | "payments" | "customers" | "standing" | "reports"

/** The role editor's layout: one row per area, its keys from least to most power. */
export const PERMISSION_GROUPS: { group: PermissionGroup; keys: Permission[] }[] = [
  { group: "bookings", keys: ["bookings.view", "bookings.manage"] },
  { group: "payments", keys: ["payments.view", "payments.record"] },
  { group: "customers", keys: ["customers.view", "customers.export", "customers.manage"] },
  { group: "standing", keys: ["standing.view", "standing.manage"] },
  { group: "reports", keys: ["reports.view"] },
]

/**
 * What the two pre-roles levels meant. Used only until /users/me answers — a session
 * restored from storage, or the moment right after login, has the old "read"/"write" but
 * not yet the role.
 */
const LEGACY_WRITE: Permission[] = PERMISSIONS.filter((p) => p !== "reports.view")
const LEGACY_READ: Permission[] = [
  "bookings.view",
  "payments.view",
  "customers.view",
  "customers.export",
  "standing.view",
]

export function legacyPermissions(level: "read" | "write" | null | undefined): Permission[] {
  return level === "write" ? LEGACY_WRITE : LEGACY_READ
}

/** The key everything else in a group depends on: you cannot manage what you cannot see. */
function viewKeyOf(key: Permission): Permission | null {
  const group = PERMISSION_GROUPS.find((g) => g.keys.includes(key))
  const view = group?.keys[0]
  return view && view !== key ? view : null
}

/**
 * Toggle one key in a role being edited, keeping the set coherent the way the server does:
 * turning on anything in a group turns on its view key, and turning the view key off turns
 * off the rest of the group. Returns catalog order so saves are stable.
 */
export function togglePermission(current: readonly string[], key: Permission, on: boolean): Permission[] {
  const set = new Set(current.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)))
  if (on) {
    set.add(key)
    const view = viewKeyOf(key)
    if (view) set.add(view)
  } else {
    set.delete(key)
    const group = PERMISSION_GROUPS.find((g) => g.keys[0] === key)
    group?.keys.forEach((k) => set.delete(k))
  }
  return PERMISSIONS.filter((p) => set.has(p))
}

/** A usage figure for a limited resource. max null = unlimited. */
export interface Usage {
  used: number
  max: number | null
}

export function isAtLimit(u: Usage | null | undefined): boolean {
  return !!u && u.max !== null && u.used >= u.max
}

/** "3 / 5", or just "3" when unlimited. */
export function formatUsage(u: Usage): string {
  return u.max === null ? String(u.used) : `${u.used} / ${u.max}`
}

/** 0..1 for a meter; 0 when unlimited, so no bar is drawn. */
export function usageRatio(u: Usage): number {
  if (u.max === null) return 0
  if (u.max === 0) return 1
  return Math.min(1, u.used / u.max)
}
