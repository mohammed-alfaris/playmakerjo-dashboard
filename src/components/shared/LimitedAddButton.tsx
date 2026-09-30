import { Button } from "@/components/ui/button"
import { isAtLimit, type Usage } from "@/lib/permissions"
import { UsageMeter } from "./UsageMeter"

/**
 * An "Add …" button that knows the company's limit. Without usage (admins, or before it
 * loads) it is a plain button — the server checks the limit either way, and its 409 message
 * reaches the user through the form's error toast.
 */
export function LimitedAddButton({
  usage,
  usageLabel,
  limitMessage,
  onClick,
  children,
}: {
  usage: Usage | null | undefined
  usageLabel: string
  /** Shown at the limit; "{max}" is filled in. */
  limitMessage: string
  onClick: () => void
  children: React.ReactNode
}) {
  const full = isAtLimit(usage)
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-4">
        {usage && <UsageMeter label={usageLabel} usage={usage} />}
        <Button onClick={onClick} disabled={full}>
          {children}
        </Button>
      </div>
      {full && usage && (
        <p className="max-w-[320px] text-end text-xs text-amber-500" role="status">
          {limitMessage.replace("{max}", String(usage.max))}
        </p>
      )}
    </div>
  )
}
