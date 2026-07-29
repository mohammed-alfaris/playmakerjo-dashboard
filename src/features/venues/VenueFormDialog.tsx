import { useCallback, useEffect, useState } from "react"
import { useForm, Controller, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, ChevronLeft, ChevronRight } from "lucide-react"
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
  type Venue, type Pitch, type SportConfig, type VenuePayload,
} from "@/api/venues"
import { getUsers } from "@/api/users"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import {
  schema, WIZARD_STEPS,
  hoursFromOperating, hoursToOperating, pitchValuesFrom, newPitchValues,
  type FormValues, type PitchValues,
} from "./form/venueFormSchema"
import { WizardStepper } from "./form/WizardStepper"
import { MediaStep } from "./form/MediaStep"
import { PitchCard } from "./form/PitchCard"
import { HoursRows } from "./form/HoursRows"

interface VenueFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venue?: Venue | null
  onSuccess?: () => void
}

export function VenueFormDialog({ open, onOpenChange, venue, onSuccess }: VenueFormDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!venue
  const { isAdmin, isOwner, userId } = useRole()
  const { t } = useT()

  const [images, setImages] = useState<string[]>([])
  const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  // Admin only. This used to run for EVERY user who opened the dialog, fetching the roster
  // of every other venue owner on the platform — a competitor list handed out as a side
  // effect of editing your own venue. (The API refuses it for owners now; this stops the
  // pointless 403 and makes the intent explicit.)
  const { data: usersData } = useQuery({
    queryKey: ["users-owners"],
    queryFn: () => getUsers({ role: "venue_owner", limit: 100 }),
    enabled: open && isAdmin,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
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

      const payload: VenuePayload = {
        name:         values.name,
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
      }
      // owner_id is admin-only on edit (the API 403s owner changes from
      // non-admins); owners always create venues as themselves.
      if (!isEdit || (isAdmin && values.ownerId !== venue!.owner.id)) {
        payload.owner_id = values.ownerId
      }
      return isEdit ? updateVenue(venue!.id, payload) : createVenue(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? t("venue_updated") : t("venue_created"))
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      // ["venues"] is NOT a prefix of ["venue", id] — TanStack matches key arrays
      // element-wise and "venues" !== "venue" — so the detail page kept serving the
      // pre-edit venue until a hard reload. Saving appeared to do nothing.
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["venue", venue.id] })
        queryClient.invalidateQueries({ queryKey: ["venue-stats", venue.id] })
      }
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
          <WizardStepper step={step} isEdit={isEdit} goToStep={goToStep} />
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
              <MediaStep images={images} setImages={setImages} register={register} />
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
