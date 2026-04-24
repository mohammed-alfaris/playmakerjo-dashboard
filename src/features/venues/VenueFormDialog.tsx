import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm, Controller, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Loader2, ImagePlus, X, Plus, Trash2, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Check,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  createVenue, updateVenue,
  type Venue, type Pitch, type SportConfig,
} from "@/api/venues"
import { getUsers } from "@/api/users"
import { useRole } from "@/hooks/useRole"
import { SPORTS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import type { DayOfWeek, OperatingHours } from "@/lib/types"

const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday",
]

/** Parses "HH:mm" to minutes-since-midnight. */
function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}

const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

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
function quarterFor(parent: string, half?: string): string | null {
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

const schema = z.object({
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

type FormValues = z.infer<typeof schema>
type PitchValues = z.infer<typeof pitchSchema>

interface VenueFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venue?: Venue | null
  onSuccess?: () => void
}

/**
 * Build a default hours[7] array from an OperatingHours map (or sane defaults).
 * Missing entries default to open 09:00–22:00.
 */
function hoursFromOperating(operating?: OperatingHours | null): PitchValues["hours"] {
  return DAYS_OF_WEEK.map<PitchValues["hours"][number]>((day) => {
    const entry = operating?.[day]
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
function hoursToOperating(rows: PitchValues["hours"]): OperatingHours {
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
function pitchValuesFrom(
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
function newPitchValues(defaultSport: string, defaultPrice: number): PitchValues {
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

type WizardStepKey = "basics" | "pitches" | "hours" | "payment" | "media"

interface WizardStep {
  key: WizardStepKey
  label: TranslationKey
  /** RHF field paths to validate before leaving this step. */
  fields: Array<keyof FormValues>
}

const WIZARD_STEPS: WizardStep[] = [
  { key: "basics",  label: "wizard_step_basics",  fields: ["name", "ownerId", "city", "address", "description"] },
  { key: "pitches", label: "wizard_step_pitches", fields: ["pitches"] },
  { key: "hours",   label: "wizard_step_hours",   fields: ["venueHours"] },
  { key: "payment", label: "wizard_step_payment", fields: ["cliqAlias", "depositPercentage"] },
  { key: "media",   label: "wizard_step_media",   fields: ["latitude", "longitude"] },
]

export function VenueFormDialog({ open, onOpenChange, venue, onSuccess }: VenueFormDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!venue
  const { isOwner, userId } = useRole()
  const { t } = useT()

  const [images, setImages]         = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const { data: usersData } = useQuery({
    queryKey: ["users-owners"],
    queryFn: () => getUsers({ role: "venue_owner", limit: 100 }),
    enabled: open,
  })
  const owners: Array<{ id: string; name: string }> = usersData?.data ?? []

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { fields: pitchFields, append, remove } = useFieldArray({
    control,
    name: "pitches",
    keyName: "fieldId",
  })

  useEffect(() => {
    if (!open) return
    setImages(venue?.images ?? [])

    // Seed pitches: the backend always returns `pitches` (legacy venues get a
    // synthesised array), so we can just reuse it. For a new venue, start with
    // one empty pitch the owner can name.
    const seededPitches: PitchValues[] = venue?.pitches && venue.pitches.length > 0
      ? venue.pitches.map((p) => pitchValuesFrom(p, venue?.operatingHours))
      : [newPitchValues("football", venue?.pricePerHour ?? 0)]

    reset(
      venue
        ? {
            name:         venue.name,
            ownerId:      venue.owner.id,
            city:         venue.city,
            address:      venue.address,
            description:  venue.description ?? "",
            latitude:     venue.latitude?.toString()  ?? "",
            longitude:    venue.longitude?.toString() ?? "",
            cliqAlias:    venue.cliqAlias ?? "",
            depositPercentage: venue.depositPercentage ?? 20,
            venueHours:   hoursFromOperating(venue.operatingHours),
            pitches:      seededPitches,
          }
        : {
            name: "", ownerId: isOwner && userId ? userId : "", city: "", address: "",
            description: "",
            latitude: "", longitude: "", cliqAlias: "", depositPercentage: 20,
            venueHours: hoursFromOperating(undefined),
            pitches: seededPitches,
          }
    )
    setExpandedPitchId(seededPitches[0]?.id ?? null)
    setStep(0)
  }, [open, venue, reset, isOwner, userId])

  const [, setIsUploading] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      toast.error(t("max_images_error"))
      return
    }
    const selected: File[] = []
    for (const file of Array.from(files).slice(0, remaining)) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t("image_too_large"))
        continue
      }
      selected.push(file)
    }
    if (selected.length === 0) return
    setIsUploading(true)
    try {
      const { uploadFile } = await import("@/api/uploads")
      const urls = await Promise.all(
        selected.map((file) => uploadFile(file, "venue"))
      )
      setImages((prev) => [...prev, ...urls])
    } catch (err) {
      console.error("Upload failed:", err)
      toast.error(t("upload_image_failed"))
    } finally {
      setIsUploading(false)
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
    if (files.length) handleFiles(files)
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const ownerName = owners.find((o) => o.id === values.ownerId)?.name ?? ""

      // Pull the offered sub-sizes for a football pitch.
      const buildFootballSplit = (p: PitchValues) => {
        const subSizes: string[] = []
        let prunedPrices: Record<string, number> = {}
        if (p.sport === "football" && p.canSplit && p.parentSize !== "5" && p.parentSize !== "6") {
          if (p.parentSize === "11" && p.halfSize) {
            subSizes.push(p.halfSize)
            if (p.offerQuarter) subSizes.push(p.halfSize === "8" ? "6" : "5")
          } else if (p.parentSize === "8" && p.offerQuarter) {
            subSizes.push("6")
          } else if (p.parentSize === "7" && p.offerQuarter) {
            subSizes.push("5")
          }
          prunedPrices = subSizes.reduce<Record<string, number>>((acc, s) => {
            const price = p.sizePrices?.[s]
            if (price && price > 0) acc[s] = price
            return acc
          }, {})
        }
        return {
          // Every football pitch carries its parentSize — that's how the
          // server knows how many capacity units it's worth and is a REQUIRED
          // field on the backend (see VenuesController.ValidateAndNormalizePitches).
          // `canSplit` only gates whether we populate subSizes/sizePrices, not
          // the parent.
          parentSize: p.sport === "football" ? p.parentSize : null,
          subSizes,
          sizePrices: prunedPrices,
        }
      }

      // Venue hours: the top-level default pitches inherit from when they
      // haven't toggled "Different hours".
      const venueOperatingHours = hoursToOperating(values.venueHours)

      // Build the pitches array we send to the API. Legacy-id pitches
      // (id starting with "legacy-" from the server's virtual projection) are
      // replaced with a fresh local UUID so the server mints a real one.
      const pitchesPayload = values.pitches.map((p) => {
        const split = buildFootballSplit(p)
        const out: Pitch = {
          id:           p.id.startsWith("legacy-") ? "" : p.id,
          name:         p.name.trim(),
          sport:        p.sport,
          pricePerHour: p.pricePerHour,
          parentSize:   split.parentSize ?? null,
          subSizes:     split.subSizes,
          sizePrices:   split.sizePrices,
          operatingHours: p.useVenueHours ? null : hoursToOperating(p.hours),
        }
        return out
      })

      // The API still carries venue.sports as a legacy set. Derive it from the
      // pitches so clients that don't read `pitches` keep working.
      const derivedSports = Array.from(new Set(pitchesPayload.map((p) => p.sport)))

      // Mirror the "primary" pitch into the venue-level legacy fields so old
      // clients / reports still see the venue's basic price + subdivision.
      const primary = values.pitches[0]
      const primaryIsFootball = primary.sport === "football"
      const legacySplit = primaryIsFootball
        ? buildFootballSplit(primary)
        : { parentSize: null, subSizes: [], sizePrices: {} }

      // Build sportsConfig map for legacy consumers that read per-sport config
      // without understanding pitches. Only populated when there are multiple
      // distinct sports (otherwise it duplicates the venue-level fields).
      const sportsConfig: Record<string, SportConfig> = {}
      if (derivedSports.length > 1) {
        for (const sport of derivedSports) {
          // Use the first pitch of that sport as the representative.
          const rep = values.pitches.find((p) => p.sport === sport)
          if (!rep) continue
          const split = buildFootballSplit(rep)
          sportsConfig[sport] = {
            pricePerHour: rep.pricePerHour,
            operatingHours: rep.useVenueHours ? venueOperatingHours : hoursToOperating(rep.hours),
            parentSize: split.parentSize,
            subSizes: split.subSizes,
            sizePrices: split.sizePrices,
          }
        }
      }

      const payload = {
        name:         values.name,
        owner:        { id: values.ownerId, name: ownerName },
        city:         values.city,
        address:      values.address,
        sports:       derivedSports,
        pricePerHour: primary.pricePerHour,
        description:  values.description,
        images,
        latitude:  values.latitude  ? parseFloat(values.latitude)  : undefined,
        longitude: values.longitude ? parseFloat(values.longitude) : undefined,
        cliqAlias: values.cliqAlias || undefined,
        depositPercentage: values.depositPercentage,
        operatingHours: venueOperatingHours,
        parentSize: legacySplit.parentSize,
        subSizes:   legacySplit.subSizes,
        sizePrices: legacySplit.sizePrices,
        sportsConfig,
        pitches:    pitchesPayload,
        sportsIsolated: derivedSports.length > 1,
      }
      return isEdit ? updateVenue(venue!.id, payload) : createVenue(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? t("venue_updated") : t("venue_created"))
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: unknown) => {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
      const serverMsg = anyErr?.response?.data?.message || anyErr?.message
      const fallback = isEdit ? t("venue_update_failed") : t("venue_create_failed")
      toast.error(serverMsg || fallback)
      console.error("Venue save failed:", err)
    },
  })

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  const handleAddPitch = useCallback(() => {
    // Seed new pitch using the last pitch's sport + price as sensible defaults.
    const current = getValues("pitches") ?? []
    const defaultSport = current[current.length - 1]?.sport ?? "football"
    const defaultPrice = current[current.length - 1]?.pricePerHour ?? 0
    const p = newPitchValues(defaultSport, defaultPrice)
    append(p)
    setExpandedPitchId(p.id)
  }, [append, getValues])

  const handleRemovePitch = useCallback((index: number, id: string) => {
    remove(index)
    setExpandedPitchId((cur) => (cur === id ? null : cur))
  }, [remove])

  /* ── Wizard nav ─────────────────────────────────────────────── */
  const isLastStep = step === WIZARD_STEPS.length - 1

  const goToStep = useCallback(async (target: number) => {
    if (target === step) return
    if (target < step) {
      // Going back never validates — let the user revisit freely.
      setStep(target)
      return
    }
    // Going forward: validate every step from current up to (but not including) target.
    for (let i = step; i < target; i++) {
      const valid = await trigger(WIZARD_STEPS[i].fields)
      if (!valid) {
        setStep(i)
        return
      }
    }
    setStep(target)
  }, [step, trigger])

  const handleNext = useCallback(async () => {
    const valid = await trigger(WIZARD_STEPS[step].fields)
    if (!valid) {
      // If the current step is the pitches step, expand the first invalid pitch
      // so the user can actually see the error.
      if (WIZARD_STEPS[step].key === "pitches" && errors.pitches) {
        const firstInvalidIdx = Array.isArray(errors.pitches)
          ? errors.pitches.findIndex((e) => e)
          : -1
        if (firstInvalidIdx >= 0) {
          const invalidId = getValues(`pitches.${firstInvalidIdx}.id`)
          if (invalidId) setExpandedPitchId(invalidId)
        }
      }
      return
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }, [step, trigger, errors.pitches, getValues])

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0))
  }, [])

  const handleFormKeyDown = useCallback((e: React.KeyboardEvent<HTMLFormElement>) => {
    // Prevent Enter inside inputs from submitting the form before the last step.
    // Textarea still inserts a newline normally.
    if (e.key === "Enter" && !isLastStep) {
      const target = e.target as HTMLElement
      if (target.tagName !== "TEXTAREA" && target.tagName !== "BUTTON") {
        e.preventDefault()
        handleNext()
      }
    }
  }, [isLastStep, handleNext])

  const slotsLeft = MAX_IMAGES - images.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* ── Header + stepper ──────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b space-y-3">
          <div>
            <DialogTitle>{isEdit ? t("edit_venue") : t("add_new_venue")}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t("wizard_step_label")} {step + 1} {t("wizard_of")} {WIZARD_STEPS.length} ·{" "}
              {t(WIZARD_STEPS[step].label)}
            </p>
          </div>
          <div className="flex items-start gap-1">
            {WIZARD_STEPS.map((s, i) => {
              const isActive = i === step
              const isDone = i < step
              // In edit mode any step is jumpable; in create mode only completed
              // steps are clickable. The active step itself is never "clickable"
              // (no-op) but renders without the disabled styling.
              const clickable = isEdit || isDone
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!clickable && !isActive}
                  onClick={() => {
                    if (clickable) goToStep(i)
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 flex-1 min-w-0 rounded-md py-1 px-1 transition-colors",
                    clickable && !isActive && "hover:bg-muted/50 cursor-pointer",
                    !clickable && !isActive && "cursor-default",
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors border",
                      isActive && "bg-brand text-brand-foreground border-brand shadow-sm",
                      isDone && !isActive && "bg-brand/15 text-brand border-brand/30",
                      !isActive && !isDone && "bg-muted text-muted-foreground border-transparent",
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10.5px] font-medium truncate max-w-full",
                      isActive && "text-brand",
                      isDone && !isActive && "text-foreground/70",
                      !isActive && !isDone && "text-muted-foreground",
                    )}
                  >
                    {t(s.label)}
                  </span>
                </button>
              )
            })}
          </div>
        </DialogHeader>

        {/* ── Form body: current step only ──────────────────────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          onKeyDown={handleFormKeyDown}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Step 1 — Basics: Name, Owner, City+Address, Description */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("venue_name")}</Label>
                  <Input id="name" placeholder="Al-Ameen Football Arena" {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>{t("owner")}</Label>
                  <Controller
                    name="ownerId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isOwner}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("select_owner")} />
                        </SelectTrigger>
                        <SelectContent>
                          {owners.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.ownerId && <p className="text-xs text-destructive">{errors.ownerId.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">{t("city")}</Label>
                    <Input id="city" placeholder="Amman" {...register("city")} />
                    {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="address">{t("address")}</Label>
                    <Input id="address" placeholder="Al-Rabweh St." {...register("address")} />
                    {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">
                    {t("description")} <span className="text-muted-foreground">({t("optional")})</span>
                  </Label>
                  <textarea
                    id="description"
                    rows={3}
                    placeholder="Brief description of the venue..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    {...register("description")}
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Pitches */}
            {step === 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("pitches")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddPitch}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {t("add_pitch")}
                  </Button>
                </div>

                {errors.pitches?.message && (
                  <p className="text-xs text-destructive">
                    {errors.pitches.message === "at_least_one_pitch"
                      ? t("at_least_one_pitch")
                      : errors.pitches.message}
                  </p>
                )}

                <div className="space-y-2">
                  {pitchFields.map((field, index) => {
                    const id = field.id
                    const expanded = expandedPitchId === id
                    return (
                      <PitchCard
                        key={field.fieldId}
                        index={index}
                        expanded={expanded}
                        onToggle={() => setExpandedPitchId(expanded ? null : id)}
                        onRemove={pitchFields.length > 1 ? () => handleRemovePitch(index, id) : undefined}
                        control={control}
                        register={register}
                        watch={watch}
                        errors={errors}
                        setValue={setValue}
                        getValues={getValues}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 3 — Venue-level hours */}
            {step === 2 && (
              <div className="space-y-2 rounded-lg border border-dashed border-muted-foreground/20 p-3">
                <Label className="text-sm">
                  {t("working_hours")}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {t("different_hours_from_venue")}?
                  </span>
                </Label>
                <HoursRows
                  basePath="venueHours"
                  control={control}
                  register={register}
                  watch={watch}
                  setValue={setValue}
                  getValues={getValues}
                  errors={errors.venueHours}
                />
              </div>
            )}

            {/* Step 4 — Payment: CliQ + deposit */}
            {step === 3 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cliqAlias">{t("cliq_alias")}</Label>
                  <Input id="cliqAlias" placeholder={t("cliq_alias_hint")} {...register("cliqAlias")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="depositPercentage">{t("deposit_percentage")}</Label>
                  <Input
                    id="depositPercentage"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    placeholder="20"
                    {...register("depositPercentage", { valueAsNumber: true })}
                  />
                </div>
              </div>
            )}

            {/* Step 5 — Media & Location: Images + lat/lng */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    {t("images")} <span className="text-muted-foreground">({t("optional")} · max {MAX_IMAGES})</span>
                  </Label>

                  {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {images.map((src, i) => (
                        <div key={i} className="relative group aspect-video rounded-md overflow-hidden bg-muted">
                          <img src={src} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {i === 0 && (
                            <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                              Cover
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {images.length < MAX_IMAGES && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = "" }}
                      />
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                          isDragging
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/40"
                        )}
                      >
                        <ImagePlus className="h-7 w-7 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{t("click_drag_images")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            PNG, JPG, WEBP · {slotsLeft} {slotsLeft === 1 ? "slot" : "slots"} remaining
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="latitude">
                      {t("latitude")} <span className="text-muted-foreground">({t("optional")})</span>
                    </Label>
                    <Input id="latitude" type="number" step="any" placeholder="31.9819" {...register("latitude")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="longitude">
                      {t("longitude")} <span className="text-muted-foreground">({t("optional")})</span>
                    </Label>
                    <Input id="longitude" type="number" step="any" placeholder="35.8718" {...register("longitude")} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Wizard footer ─────────────────────────────────── */}
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0 sm:justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={mutation.isPending}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  {t("wizard_back")}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {t("cancel")}
              </Button>
              {!isLastStep ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={mutation.isPending}
                  className="gap-1"
                >
                  {t("wizard_next")}
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              ) : (
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? t("save_changes") : t("create_venue")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Pitch card — collapsible section for a single pitch's config   */
/* ────────────────────────────────────────────────────────────── */

interface PitchCardProps {
  index: number
  expanded: boolean
  onToggle: () => void
  onRemove?: () => void
  control: ReturnType<typeof useForm<FormValues>>["control"]
  register: ReturnType<typeof useForm<FormValues>>["register"]
  watch: ReturnType<typeof useForm<FormValues>>["watch"]
  errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"]
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"]
  getValues: ReturnType<typeof useForm<FormValues>>["getValues"]
}

function PitchCard({
  index, expanded, onToggle, onRemove,
  control, register, watch, errors, setValue, getValues,
}: PitchCardProps) {
  const { t, lang } = useT()

  const name = watch(`pitches.${index}.name`)
  const sport = watch(`pitches.${index}.sport`)
  const parent = watch(`pitches.${index}.parentSize`)
  const canSplit = watch(`pitches.${index}.canSplit`)
  const halfSize = watch(`pitches.${index}.halfSize`)
  const offerQuarter = watch(`pitches.${index}.offerQuarter`)
  const useVenueHours = watch(`pitches.${index}.useVenueHours`)
  const pitchErr = errors.pitches?.[index]
  const isFootball = sport === "football"

  const offeredSizes = useMemo(() => {
    if (!isFootball || !canSplit) return []
    const out: string[] = []
    if (parent === "11" && halfSize) {
      out.push(halfSize)
      if (offerQuarter) out.push(halfSize === "8" ? "6" : "5")
    } else if (parent === "8" && offerQuarter) out.push("6")
    else if (parent === "7" && offerQuarter) out.push("5")
    return out
  }, [isFootball, canSplit, parent, halfSize, offerQuarter])

  const quarterLabel = isFootball ? quarterFor(parent, halfSize) : null

  const sportMeta = SPORTS.find((s) => s.value === sport)
  const sportLabel = sportMeta ? (lang === "ar" ? sportMeta.labelAr : sportMeta.label) : sport
  const sizeLabel = isFootball && parent ? `${parent}${t("a_side")}` : null

  // Summary line shown on the collapsed card header
  const summary = [sportLabel, sizeLabel].filter(Boolean).join(" · ")

  return (
    <div className="rounded-lg border bg-card">
      {/* Header (always visible) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-sm font-medium truncate">
            {name || `${t("pitch")} ${index + 1}`}
          </span>
          <span className="text-xs text-muted-foreground truncate">{summary}</span>
        </button>
        <div className="flex items-center gap-1">
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onRemove}
              title={t("remove_pitch")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggle}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t p-3 space-y-4">
          {/* Name + Sport */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`pitch-name-${index}`}>{t("pitch_name")}</Label>
              <Input
                id={`pitch-name-${index}`}
                placeholder={t("pitch_name_placeholder")}
                {...register(`pitches.${index}.name`)}
              />
              {pitchErr?.name?.message && (
                <p className="text-xs text-destructive">
                  {pitchErr.name.message === "pitch_name_required"
                    ? t("pitch_name_required")
                    : pitchErr.name.message === "pitch_names_must_be_unique"
                    ? t("pitch_names_must_be_unique")
                    : pitchErr.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("sport")}</Label>
              <Controller
                name={`pitches.${index}.sport`}
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPORTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {lang === "ar" ? s.labelAr : s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Price + (football only) pitch size */}
          <div className={cn("grid gap-3", isFootball ? "grid-cols-2" : "grid-cols-1")}>
            {isFootball && (
              <div className="space-y-1.5">
                <Label>{t("pitch_size")}</Label>
                <Controller
                  name={`pitches.${index}.parentSize`}
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["5", "6", "7", "8", "11"].map((sz) => (
                          <SelectItem key={sz} value={sz}>
                            {sz}
                            {t("a_side")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`price-${index}`}>{t("price_per_hour")}</Label>
              <Input
                id={`price-${index}`}
                type="number"
                min={0}
                step={0.5}
                placeholder="25"
                {...register(`pitches.${index}.pricePerHour`, { valueAsNumber: true })}
              />
              {pitchErr?.pricePerHour && (
                <p className="text-xs text-destructive">{pitchErr.pricePerHour.message}</p>
              )}
            </div>
          </div>

          {/* Subdivision (football-only) */}
          {isFootball && (parent === "7" || parent === "8" || parent === "11") && (
            <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/30 p-3">
              <Controller
                name={`pitches.${index}.canSplit`}
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <span
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                        field.value ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                          field.value ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{t("split_pitch_question")}</span>
                      <span className="block text-xs text-muted-foreground">{t("split_pitch_hint")}</span>
                    </span>
                  </button>
                )}
              />

              {canSplit && parent === "11" && (
                <div className="space-y-1.5">
                  <Label>{t("half_field_size")}</Label>
                  <Controller
                    name={`pitches.${index}.halfSize`}
                    control={control}
                    render={({ field }) => (
                      <div className="flex gap-2">
                        {["8", "7"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => field.onChange(opt)}
                            className={cn(
                              "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                              field.value === opt
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-input hover:bg-muted/50"
                            )}
                          >
                            {opt}
                            {t("a_side")}
                          </button>
                        ))}
                      </div>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">{t("half_field_hint")}</p>
                </div>
              )}

              {canSplit && quarterLabel && (parent !== "11" || halfSize) && (
                <Controller
                  name={`pitches.${index}.offerQuarter`}
                  control={control}
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                      <span>
                        {quarterLabel === "6"
                          ? t("also_offer_six_aside")
                          : t("also_offer_five_aside")}
                      </span>
                    </label>
                  )}
                />
              )}

              {offeredSizes.length > 0 && (
                <div className="space-y-2">
                  {offeredSizes.map((sz) => (
                    <div key={sz} className="space-y-1">
                      <Label className="text-xs">
                        {t("price_when_n_aside").replace("{size}", sz)}
                      </Label>
                      <Controller
                        name={`pitches.${index}.sizePrices.${sz}` as const}
                        control={control}
                        render={({ field }) => (
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            placeholder="—"
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const v = e.target.value
                              field.onChange(v === "" ? undefined : parseFloat(v))
                            }}
                          />
                        )}
                      />
                      {(() => {
                        const msg = pitchErr?.sizePrices?.[sz]?.message
                        if (typeof msg === "string" && msg.startsWith("price_required_for_size:")) {
                          const size = msg.split(":")[1]
                          return (
                            <p className="text-xs text-destructive">
                              {t("price_required_for_size").replace("{size}", size)}
                            </p>
                          )
                        }
                        return null
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Different-hours toggle + per-pitch hours when on */}
          <Controller
            name={`pitches.${index}.useVenueHours`}
            control={control}
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={!field.value}
                  onChange={(e) => field.onChange(!e.target.checked)}
                />
                <span>{t("different_hours_from_venue")}</span>
              </label>
            )}
          />

          {!useVenueHours && (
            <HoursRows
              basePath={`pitches.${index}.hours`}
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              getValues={getValues}
              errors={pitchErr?.hours}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Hours rows — reused for both venue-level default and per-pitch  */
/* ────────────────────────────────────────────────────────────── */

interface HoursRowsProps {
  /** Either "venueHours" (venue-level) or `pitches.{n}.hours` (per-pitch). */
  basePath: "venueHours" | `pitches.${number}.hours`
  control: ReturnType<typeof useForm<FormValues>>["control"]
  register: ReturnType<typeof useForm<FormValues>>["register"]
  watch: ReturnType<typeof useForm<FormValues>>["watch"]
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"]
  getValues: ReturnType<typeof useForm<FormValues>>["getValues"]
  // RHF's FieldErrors shape for an array is a Merge<FieldError, ...[]> — keep it
  // permissive here so both callers (top-level venueHours and per-pitch hours)
  // can pass their errors sub-tree in as-is.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: any
}

function HoursRows({
  basePath, control, register, watch, setValue, getValues, errors,
}: HoursRowsProps) {
  const { t } = useT()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const mon = getValues(`${basePath}.0` as `venueHours.0`)
            if (!mon) return
            for (let i = 1; i < 7; i++) {
              setValue(`${basePath}.${i}.open` as `venueHours.0.open`, mon.open, { shouldDirty: true })
              setValue(`${basePath}.${i}.close` as `venueHours.0.close`, mon.close, { shouldDirty: true })
              setValue(`${basePath}.${i}.closed` as `venueHours.0.closed`, mon.closed, { shouldDirty: true })
            }
          }}
        >
          {t("apply_to_all_days")}
        </Button>
      </div>
      <div className="space-y-1.5">
        {DAYS_OF_WEEK.map((day, dIdx) => {
          const row = watch(`${basePath}.${dIdx}` as `venueHours.0`)
          const overnight =
            row && !row.closed &&
            TIME_REGEX.test(row.open) && TIME_REGEX.test(row.close) &&
            parseHHMM(row.close) <= parseHHMM(row.open)
          const rowErr = errors?.[dIdx]
          return (
            <div key={day} className="space-y-1">
              <div className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2">
                <span className="text-sm font-medium">{t(day as TranslationKey)}</span>
                <Input
                  type="time"
                  disabled={row?.closed}
                  className={cn("h-9", row?.closed && "opacity-50")}
                  {...register(`${basePath}.${dIdx}.open` as `venueHours.0.open`)}
                />
                <Input
                  type="time"
                  disabled={row?.closed}
                  className={cn("h-9", row?.closed && "opacity-50")}
                  {...register(`${basePath}.${dIdx}.close` as `venueHours.0.close`)}
                />
                <Controller
                  name={`${basePath}.${dIdx}.closed` as `venueHours.0.closed`}
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      title={field.value ? t("closed") : t("open")}
                      className={cn(
                        "h-9 px-3 rounded-md border text-xs font-medium transition-colors whitespace-nowrap",
                        field.value
                          ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                      )}
                    >
                      {field.value ? t("closed") : t("open")}
                    </button>
                  )}
                />
              </div>
              <div className="flex items-center gap-2 pl-[88px] min-h-[14px]">
                {overnight && (
                  <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0">
                    · {t("hours_next_day")}
                  </span>
                )}
                {rowErr?.close?.message && (
                  <p className="text-xs text-destructive">
                    {rowErr.close.message === "open_close_must_differ"
                      ? t("open_close_must_differ")
                      : rowErr.close.message}
                  </p>
                )}
                {rowErr?.open?.message && !rowErr?.close?.message && (
                  <p className="text-xs text-destructive">{rowErr.open.message}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
