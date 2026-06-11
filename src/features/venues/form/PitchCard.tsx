import { useMemo } from "react"
import { Controller } from "react-hook-form"
import type {
  Control, FieldErrors, UseFormGetValues, UseFormRegister, UseFormSetValue, UseFormWatch,
} from "react-hook-form"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { SPORTS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { quarterFor, type FormValues } from "./venueFormSchema"
import { HoursRows } from "./HoursRows"

/* ────────────────────────────────────────────────────────────── */
/*  Pitch card — collapsible section for a single pitch's config   */
/* ────────────────────────────────────────────────────────────── */

interface PitchCardProps {
  index: number
  expanded: boolean
  onToggle: () => void
  onRemove?: () => void
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  watch: UseFormWatch<FormValues>
  errors: FieldErrors<FormValues>
  setValue: UseFormSetValue<FormValues>
  getValues: UseFormGetValues<FormValues>
}

export function PitchCard({
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
