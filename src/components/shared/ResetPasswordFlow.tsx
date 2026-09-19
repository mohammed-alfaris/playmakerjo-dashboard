import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Copy, Check, Loader2, KeyRound } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { resetUserPassword, type ResetPasswordResult } from "@/api/users"
import { useT } from "@/i18n/LanguageContext"

/**
 * Confirm, reset, then show the new password exactly once.
 *
 * Lives here rather than in each page because the second half is the part that is easy to get
 * wrong: the plaintext exists only in that one HTTP response. It is bcrypt-hashed before the
 * row is saved and never logged, so if this dialog is dismissed before the admin copies it,
 * the only remedy is another reset. Both screens showing the same dialog means that property
 * is stated in one place.
 */
export function ResetPasswordFlow({
  target,
  onOpenChange,
}: {
  /** The user to reset, or null when the flow is closed. */
  target: { id: string; name: string; email: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  const [result, setResult] = useState<ResetPasswordResult | null>(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
    onSuccess: (res) => {
      // Close the confirm and open the result. Deliberately NOT a toast: a toast
      // auto-dismisses, and this is the only time this value is ever visible.
      setResult(res.data)
      setCopied(false)
      onOpenChange(false)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? t("something_went_wrong")),
  })

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.temporaryPassword)
      setCopied(true)
      toast.success(t("copied"))
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). The password is on
      // screen and selectable either way, so this must not read as "the reset failed".
      toast.error(t("copy_failed"))
    }
  }

  return (
    <>
      <ConfirmDialog
        open={!!target}
        onOpenChange={(v) => { if (!v) onOpenChange(false) }}
        title={t("reset_password")}
        description={t("reset_password_confirm").replace("{name}", target?.name ?? "")}
        confirmLabel={t("reset_password")}
        isLoading={mutation.isPending}
        onConfirm={() => target && mutation.mutate(target.id)}
      />

      <Dialog open={!!result} onOpenChange={(v) => { if (!v) setResult(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {t("reset_password_done_title")}
            </DialogTitle>
            <DialogDescription>
              {t("reset_password_done_body").replace("{email}", result?.email ?? "")}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/40 p-3">
            {/* dir="ltr" and a mono font because this gets read aloud down a phone and typed
                back. In an RTL layout an unmarked password renders in an order nobody can
                dictate from. */}
            <div
              dir="ltr"
              className="select-all break-all text-center font-mono text-lg tracking-wide"
            >
              {result?.temporaryPassword}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t("reset_password_once_warning")}</p>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" className="gap-1.5" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copy")}
            </Button>
            <Button type="button" onClick={() => setResult(null)}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mutation.isPending && (
        <span className="sr-only" role="status">
          <Loader2 className="animate-spin" /> {t("reset_password")}
        </span>
      )}
    </>
  )
}
