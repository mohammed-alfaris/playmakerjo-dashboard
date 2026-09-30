import { cn } from "@/lib/utils"

/** A small set of mutually exclusive choices, drawn as buttons — the dashboard's radio group. */
export function ChoiceButtons<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
}) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-start text-sm transition-colors",
            value === o.value
              ? "border-[hsl(var(--brand))] bg-brand-tint text-brand-ink"
              : "border-[hsl(var(--line))] text-[hsl(var(--ink-2))] hover:bg-surface-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
