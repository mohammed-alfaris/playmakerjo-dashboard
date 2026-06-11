import { Controller } from "react-hook-form"
import type {
  Control, UseFormGetValues, UseFormRegister, UseFormSetValue, UseFormWatch,
} from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import {
  DAYS_OF_WEEK, TIME_REGEX, parseHHMM,
  type FormValues,
} from "./venueFormSchema"

/* ────────────────────────────────────────────────────────────── */
/*  Hours rows — reused for both venue-level default and per-pitch  */
/* ────────────────────────────────────────────────────────────── */

interface HoursRowsProps {
  /** Either "venueHours" (venue-level) or `pitches.{n}.hours` (per-pitch). */
  basePath: "venueHours" | `pitches.${number}.hours`
  control: Control<FormValues>
  register: UseFormRegister<FormValues>
  watch: UseFormWatch<FormValues>
  setValue: UseFormSetValue<FormValues>
  getValues: UseFormGetValues<FormValues>
  // RHF's FieldErrors shape for an array is a Merge<FieldError, ...[]> — keep it
  // permissive here so both callers (top-level venueHours and per-pitch hours)
  // can pass their errors sub-tree in as-is.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: any
}

export function HoursRows({
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
