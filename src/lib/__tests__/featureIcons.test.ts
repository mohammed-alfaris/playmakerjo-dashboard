import { describe, it, expect } from "vitest"
import { CircleCheck, CircleParking } from "lucide-react"
import { FEATURE_ICONS, featureIcon } from "@/lib/featureIcons"

/**
 * The icon set MIRRORS the API's Constants/VenueFeatureIcons.cs. A key the API accepts but
 * this map lacks would render the fallback for every venue using it, so the list is pinned
 * against the server's, key for key.
 */
const API_ICON_KEYS = [
  "parking", "shower", "changing_room", "locker", "wifi", "floodlights",
  "cafe", "water", "seating", "prayer_room", "first_aid", "accessible",
  "air_conditioning", "restroom", "equipment", "cctv", "kids_area", "indoor",
]

describe("featureIcon", () => {
  it("covers exactly the keys the API accepts, in the same order", () => {
    expect(FEATURE_ICONS.map((i) => i.key)).toEqual(API_ICON_KEYS)
  })

  it("maps a known key to its icon", () => {
    expect(featureIcon("parking")).toBe(CircleParking)
  })

  it("falls back to a neutral icon for a key this build does not know", () => {
    expect(featureIcon("helipad")).toBe(CircleCheck)
    expect(featureIcon(undefined)).toBe(CircleCheck)
    expect(featureIcon("")).toBe(CircleCheck)
  })
})
