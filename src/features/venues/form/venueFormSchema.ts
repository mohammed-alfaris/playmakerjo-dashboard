import { z } from "zod"
import type { Pitch } from "@/api/venues"
import type { TranslationKey } from "@/i18n/translations"
import type { DayOfWeek, OperatingHours } from "@/lib/types"

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
]

/** Parses "HH:mm" to minutes-since-midnight. */
export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}

export const MAX_IMAGES = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const dayHoursSchema = z.object({
  day:    z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  open:   z.string(),
  close:  z.string(),
  closed: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.closed) return
  if (!TIME_REGEX.test(v.open)) {
    ctx.addIssue({ code: "custom", path: ["open"], message: "Use HH:mm format" })
  }
  if (!TIME_REGEX.test(v.close)) {
    ctx.addIssue({ code: "custom", path: ["close"], message: "Use HH:mm format" })
  }
  if (TIME_REGEX.test(v.open) && TIME_REGEX.test(v.close) && v.open === v.close) {
    ctx.addIssue({ code: "custom", path: ["close"], message: "open_close_must_differ" })
  }
})

/**
 * Deterministic quarter-size given parent + chosen half. Mirrors the backend
 * rule table: 11+half=8 → 6, 11+half=7 → 5, 8 → 6, 7 → 5.
 */
export function quarterFor(parent: string, half?: string): string | null {
  if (parent === "11") return half === "8" ? "6" : half === "7" ? "5" : null
  if (parent === "8") return "6"
  if (parent === "7") return "5"
  return null
}

/**
 * A single pitch's config. One pitch = one sport. Subdivision is football-only
 * and scoped to this pitch (Pitch 1 splitting into 8+6 doesn't affect Pitch 2).
 * When `useVenueHours` is true the pitch inherits the venue-level hours; when
 * false, the per-pitch `hours[7]` is used.
 */
const pitchSchema = z.object({
  id:           z.string(),                // local id (server mints real one on save)
  name:         z.string().min(1, "pitch_name_required"),
  sport:        z.string().min(1, "pitch_sport_required"),
  pricePerHour: z.number({ error: "Enter a valid price" }).positive("Price must be positive"),
  parentSize:   z.enum(["5", "6", "7", "8", "11"]),
  canSplit:     z.boolean(),
  halfSize:     z.enum(["8", "7"]).optional(),
  offerQuarter: z.boolean(),
  sizePrices:   z.record(z.string(), z.number().nonnegative()),
  useVenueHours: z.boolean(),
  hours:        z.array(dayHoursSchema).length(7),
}).superRefine((v, ctx) => {
  // Split config is football-only — silently skip validation for other sports.
  if (v.sport !== "football") return
  if (!v.canSplit) return
  if (v.parentSize === "5" || v.parentSize === "6") return
  const offered: string[] = []
  if (v.parentSize === "11") {
    if (!v.halfSize) {
      ctx.addIssue({ code: "custom", path: ["halfSize"], message: "half_field_required" })
      return
    }
    offered.push(v.halfSize)
    if (v.offerQuarter) offered.push(v.halfSize === "8" ? "6" : "5")
  } else if (v.parentSize === "8") {
    if (v.offerQuarter) offered.push("6")
  } else if (v.parentSize === "7") {
    if (v.offerQuarter) offered.push("5")
  }
  for (const sz of offered) {
    const price = v.sizePrices?.[sz]
    if (!price || price <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sizePrices", sz],
        message: `price_required_for_size:${sz}`,
      })
    }
  }
})

export const schema = z.object({
  name:         z.string().min(2, "Name must be at least 2 characters"),
  ownerId:      z.string().min(1, "Owner is required"),
  city:         z.string().min(2, "City is required"),
  address:      z.string().min(5, "Address must be at least 5 characters"),
  description:  z.string().optional(),
  latitude:     z.string().optional(),
  longitude:    z.string().optional(),
  cliqAlias:    z.string().optional(),
  depositPercentage: z.number().optional(),
  // Venue-level default hours — a pitch that toggles "Different hours" gets its
  // own override, otherwise it inherits these.
  venueHours:   z.array(dayHoursSchema).length(7),
  // The pitches list — the core of multi-pitch venues. Must be non-empty and
  // pitch names must be unique (the user would not be able to tell Pitch 1
  // apart from another Pitch 1 on the timeline).
  pitches:      z.array(pitchSchema).min(1, "at_least_one_pitch"),
}).superRefine((v, ctx) => {
  const seen = new Map<string, number>()
  v.pitches.forEach((p, idx) => {
    const key = (p.name || "").trim().toLowerCase()
    if (!key) return
    if (seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: ["pitches", idx, "name"],
        message: "pitch_names_must_be_unique",
      })
    } else {
      seen.set(key, idx)
    }
  })
})

export type FormValues = z.infer<typeof schema>
export type PitchValues = z.infer<typeof pitchSchema>

/**
 * Build a default hours[7] array from an OperatingHours map (or sane defaults).
 * Missing entries default to open 09:00–22:00.
 *
 * Backend has historically serialized day keys as either full form
 * (`monday`, …) or 3-letter short form (`mon`, …). We accept both so
 * editing an existing venue surfaces its real hours regardless of which
 * shape they were saved in.
 */
export const FULL_TO_SHORT_DAY: Record<DayOfWeek, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
}

export function hoursFromOperating(operating?: OperatingHours | null): PitchValues["hours"] {
  const oh = (operating ?? {}) as Record<string, OperatingHours[DayOfWeek] | undefined>
  return DAYS_OF_WEEK.map<PitchValues["hours"][number]>((day) => {
    const entry = oh[day] ?? oh[FULL_TO_SHORT_DAY[day]]
    if (!entry || entry.closed) {
      return {
        day,
        open:   entry?.open  || "09:00",
        close:  entry?.close || "22:00",
        closed: !!entry?.closed,
      }
    }
    return { day, open: entry.open, close: entry.close, closed: false }
  })
}

/** Serialize an hours[7] back into the OperatingHours map the API expects. */
export function hoursToOperating(rows: PitchValues["hours"]): OperatingHours {
  const h: OperatingHours = {}
  for (const row of rows) {
    h[row.day] = row.closed
      ? { open: "", close: "", closed: true }
      : { open: row.open, close: row.close }
  }
  return h
}

/**
 * Seed a PitchValues from a Pitch coming back from the API. Extracts the
 * split-config (halfSize + offerQuarter) from the subSizes array.
 */
export function pitchValuesFrom(
  p: Pitch,
  venueHours: OperatingHours | undefined
): PitchValues {
  const isFootball = p.sport === "football"
  const parent = (p.parentSize ?? "7") as PitchValues["parentSize"]
  const subs = p.subSizes ?? []
  const savedHalf = subs.find((s) => s === "8" || s === "7") as PitchValues["halfSize"] | undefined
  const savedHasQuarter = subs.some((s) => s === "6" || s === "5")
  const savedCanSplit = subs.length > 0

  // Pitch carries explicit operatingHours? → "different hours" mode.
  // Otherwise it inherits the venue default.
  const ownHours = p.operatingHours
  const useVenueHours = !ownHours

  return {
    id:           p.id || crypto.randomUUID(),
    name:         p.name || "",
    sport:        p.sport || "football",
    pricePerHour: p.pricePerHour ?? 0,
    parentSize:   isFootball ? parent : "7",
    canSplit:     isFootball && savedCanSplit,
    halfSize:     isFootball ? savedHalf : undefined,
    offerQuarter: isFootball && savedHasQuarter,
    sizePrices:   isFootball ? (p.sizePrices ?? {}) : {},
    useVenueHours,
    hours:        hoursFromOperating(useVenueHours ? venueHours : ownHours),
  }
}

/** Seed a fresh pitch when the user hits [+ Add pitch]. */
export function newPitchValues(defaultSport: string, defaultPrice: number): PitchValues {
  return {
    id:           crypto.randomUUID(),
    name:         "",
    sport:        defaultSport,
    pricePerHour: defaultPrice,
    parentSize:   "7",
    canSplit:     false,
    halfSize:     undefined,
    offerQuarter: false,
    sizePrices:   {},
    useVenueHours: true,
    hours:        hoursFromOperating(undefined),
  }
}

/* ────────────────────────────────────────────────────────────── */
/*  Wizard step definitions                                        */
/* ────────────────────────────────────────────────────────────── */

export type WizardStepKey = "basics" | "pitches" | "hours" | "payment" | "media"

export interface WizardStep {
  key: WizardStepKey
  label: TranslationKey
  /** RHF field paths to validate before leaving this step. */
  fields: Array<keyof FormValues>
}

export const WIZARD_STEPS: WizardStep[] = [
  { key: "basics",  label: "wizard_step_basics",  fields: ["name", "ownerId", "city", "address", "description"] },
  { key: "pitches", label: "wizard_step_pitches", fields: ["pitches"] },
  { key: "hours",   label: "wizard_step_hours",   fields: ["venueHours"] },
  { key: "payment", label: "wizard_step_payment", fields: ["cliqAlias", "depositPercentage"] },
  { key: "media",   label: "wizard_step_media",   fields: ["latitude", "longitude"] },
]
