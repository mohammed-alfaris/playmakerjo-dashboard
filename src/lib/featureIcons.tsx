import {
  Accessibility, AirVent, Armchair, Baby, BriefcaseMedical, Cctv, CircleCheck, CircleParking,
  Coffee, Dumbbell, GlassWater, Lightbulb, LockKeyhole, MoonStar, Shirt, ShowerHead, Toilet,
  Warehouse, Wifi, type LucideIcon,
} from "lucide-react"

/**
 * The icon keys a catalog feature may carry, in the order the admin's picker shows them.
 *
 * MIRRORS the API's Constants/VenueFeatureIcons.cs, which rejects any other key, and the
 * app's lib/core/theme/feature_icons.dart. Keys are a fixed set rather than uploaded images
 * so every client renders a native, theme-aware icon.
 */
export const FEATURE_ICONS: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: "parking",          icon: CircleParking },
  { key: "shower",           icon: ShowerHead },
  { key: "changing_room",    icon: Shirt },
  { key: "locker",           icon: LockKeyhole },
  { key: "wifi",             icon: Wifi },
  { key: "floodlights",      icon: Lightbulb },
  { key: "cafe",             icon: Coffee },
  { key: "water",            icon: GlassWater },
  { key: "seating",          icon: Armchair },
  { key: "prayer_room",      icon: MoonStar },
  { key: "first_aid",        icon: BriefcaseMedical },
  { key: "accessible",       icon: Accessibility },
  { key: "air_conditioning", icon: AirVent },
  { key: "restroom",         icon: Toilet },
  { key: "equipment",        icon: Dumbbell },
  { key: "cctv",             icon: Cctv },
  { key: "kids_area",        icon: Baby },
  { key: "indoor",           icon: Warehouse },
]

const BY_KEY = new Map(FEATURE_ICONS.map((i) => [i.key, i.icon]))

/**
 * The icon for a key. An unknown key — one the API gained after this dashboard was built —
 * gets a neutral check rather than nothing, so a newer catalog never renders blank here.
 */
export function featureIcon(key: string | null | undefined): LucideIcon {
  return (key && BY_KEY.get(key)) || CircleCheck
}
