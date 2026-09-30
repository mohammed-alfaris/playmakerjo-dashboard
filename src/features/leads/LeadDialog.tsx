import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { LEAD_STAGES, updateVenueLead, type LeadStatus, type VenueLead } from "@/api/leads"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserFormDialog } from "@/features/users/UserFormDialog"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"

const selectClass =
  "h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * One lead, moved along: its stage, when to call back, what was said, why it was lost.
 * "Create owner account" opens the usual create-user form already filled from the lead; once
 * the account exists the lead is marked won and linked to it.
 */
export function LeadDialog({ lead, onClose }: { lead: VenueLead | null; onClose: () => void }) {
  return lead ? <Body lead={lead} onClose={onClose} /> : null
}

function Body({ lead, onClose }: { lead: VenueLead; onClose: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [followUp, setFollowUp] = useState(lead.nextFollowUpOn ?? "")
  const [notes, setNotes] = useState(lead.notes ?? "")
  const [lostReason, setLostReason] = useState(lead.lostReason ?? "")
  const [converting, setConverting] = useState(false)

  const refresh = () => qc.invalidateQueries({ queryKey: ["leads"] })
  const fail = (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message ?? t("something_went_wrong"))

  const save = useMutation({
    mutationFn: () => updateVenueLead(lead.id, {
      status, notes, nextFollowUpOn: followUp, lostReason: status === "lost" ? lostReason : undefined,
    }),
    onSuccess: () => { toast.success(t("lead_saved")); refresh(); onClose() },
    onError: fail,
  })
  const link = useMutation({
    mutationFn: (ownerId: string) => updateVenueLead(lead.id, { convertedOwnerId: ownerId }),
    onSuccess: () => { toast.success(t("lead_won")); refresh(); onClose() },
    onError: fail,
  })

  return (
    <>
      <Dialog open={!converting} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lead.venueName}</DialogTitle>
            <DialogDescription>
              {lead.contactName} · <span dir="ltr">{lead.phone}</span> · {lead.city}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-stage">{t("lead_stage")}</Label>
              <select id="lead-stage" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
                {LEAD_STAGES.map((s) => <option key={s} value={s}>{t(`lead_stage_${s}` as TranslationKey)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-follow">{t("lead_follow_up")}</Label>
              <Input
                id="lead-follow" type="date" className="num" value={followUp}
                disabled={status === "won" || status === "lost"}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>
            {status === "lost" && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="lead-lost">{t("lead_lost_reason")}</Label>
                <Input id="lead-lost" maxLength={255} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-notes">{t("notes")}</Label>
              <textarea
                id="lead-notes" rows={5} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={t("lead_notes_placeholder")}
                className="w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 py-1.5 text-sm focus:border-[hsl(var(--brand))] focus:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {lead.status !== "won" ? (
              <Button variant="outline" className="gap-1" onClick={() => setConverting(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                {t("lead_convert")}
              </Button>
            ) : <span className="self-center text-xs text-muted-foreground">{t("lead_already_won")}</span>}
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserFormDialog
        open={converting}
        onOpenChange={(v) => { if (!v) setConverting(false) }}
        initial={{ name: lead.contactName, email: lead.email, phone: lead.phone, role: "venue_owner", companyName: lead.venueName }}
        onCreated={(ownerId) => link.mutate(ownerId)}
      />
    </>
  )
}
