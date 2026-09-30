/**
 * What an owner may type as their own venue feature.
 *
 * MIRRORS the API's Helpers/VenueFeatureRules.cs so the picker refuses the same input the
 * server would, before a whole wizard's worth of changes is sent. It is a UX mirror, not the
 * guard: the server re-applies every rule and stays the authority.
 */

export const MAX_CUSTOM_LABEL_LENGTH = 40
export const MAX_CUSTOM_PER_VENUE = 15

export interface CatalogName {
  id: string
  name: string
  nameAr: string
}

/** Trim, and collapse any internal run of whitespace to a single space. */
export function cleanLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

export type AddLabelResult =
  | { kind: "catalog"; id: string }
  | { kind: "custom"; label: string }
  | { kind: "duplicate" }
  | { kind: "empty" }
  | { kind: "too_long" }
  | { kind: "too_many" }

/**
 * Decide what typing `raw` into "add your own" should do.
 *
 * A label equal to a catalog name — English or Arabic, ignoring case — selects that catalog
 * feature instead of adding a duplicate typed one. The server does the same on save; doing it
 * here too means the owner sees the icon chip light up immediately, rather than their typed
 * chip silently becoming something else after saving.
 */
export function addCustomLabel(
  raw: string,
  existingCustom: readonly string[],
  catalog: readonly CatalogName[],
): AddLabelResult {
  const label = cleanLabel(raw)
  if (label.length === 0) return { kind: "empty" }
  if (label.length > MAX_CUSTOM_LABEL_LENGTH) return { kind: "too_long" }

  const folded = label.toLocaleLowerCase()
  const match = catalog.find(
    (f) => f.name.toLocaleLowerCase() === folded || f.nameAr.toLocaleLowerCase() === folded,
  )
  if (match) return { kind: "catalog", id: match.id }

  if (existingCustom.some((c) => c.toLocaleLowerCase() === folded)) return { kind: "duplicate" }
  if (existingCustom.length >= MAX_CUSTOM_PER_VENUE) return { kind: "too_many" }
  return { kind: "custom", label }
}
