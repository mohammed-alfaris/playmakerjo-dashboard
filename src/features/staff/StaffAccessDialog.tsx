import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { updateStaffAssignment, type StaffMember } from "@/api/staff"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useT } from "@/i18n/LanguageContext"
import { StaffAccessFields } from "./StaffAccessFields"
import { useTeamLookups, validateAccess, type StaffAccessValue } from "./teamAccess"

/** Change one clerk's role and venues. Applies on their next click — no re-login. */
export default function StaffAccessDialog({
  member,
  onOpenChange,
}: {
  member: StaffMember | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useT()
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("staff_edit_access")}</DialogTitle>
          <DialogDescription>{member?.name}</DialogDescription>
        </DialogHeader>
        {member && <AccessForm member={member} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function AccessForm({ member, onDone }: { member: StaffMember; onDone: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const { roles, venues } = useTeamLookups()
  const [access, setAccess] = useState<StaffAccessValue>({
    staffRoleId: member.staffRole?.id ?? "",
    allVenues: member.allVenues ?? true,
    venueIds: member.venueIds ?? [],
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => updateStaffAssignment(member.id, access),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      qc.invalidateQueries({ queryKey: ["staff-roles"] })
      toast.success(t("staff_permission_updated"))
      onDone()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(message ?? t("something_went_wrong"))
    },
  })

  function save() {
    const bad = validateAccess(access)
    if (bad) {
      setError(bad === "role" ? t("staff_role_pick") : t("staff_venues_pick"))
      return
    }
    mutation.mutate()
  }

  return (
    <>
      <StaffAccessFields value={access} onChange={setAccess} roles={roles} venues={venues} error={error} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          {t("cancel")}
        </Button>
        <Button onClick={save} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {t("save")}
        </Button>
      </DialogFooter>
    </>
  )
}
