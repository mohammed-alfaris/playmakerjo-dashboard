import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { WIZARD_STEPS } from "./venueFormSchema"

interface WizardStepperProps {
  step: number
  isEdit: boolean
  goToStep: (target: number) => void
}

export function WizardStepper({ step, isEdit, goToStep }: WizardStepperProps) {
  const { t } = useT()

  return (
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
  )
}
