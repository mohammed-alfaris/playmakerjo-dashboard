import { describe, expect, it } from "vitest"
import { translations } from "@/i18n/translations"
import { PERMISSIONS, PERMISSION_GROUPS } from "../permissions"

describe("translations", () => {
  it("English and Arabic have exactly the same keys", () => {
    const en = Object.keys(translations.en).sort()
    const ar = Object.keys(translations.ar).sort()
    expect(en.filter((k) => !ar.includes(k))).toEqual([])
    expect(ar.filter((k) => !en.includes(k))).toEqual([])
  })

  it("has a label for every permission and group the role editor shows", () => {
    // The editor builds these keys from strings, so the type checker cannot catch a missing one.
    const needed = [
      ...PERMISSIONS.map((p) => `perm_${p.replace(".", "_")}`),
      ...PERMISSION_GROUPS.map((g) => `perm_group_${g.group}`),
    ]
    for (const lang of ["en", "ar"] as const) {
      const missing = needed.filter((k) => !(k in translations[lang]))
      expect(missing, lang).toEqual([])
    }
  })
})
