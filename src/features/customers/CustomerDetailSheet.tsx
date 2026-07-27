import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Phone, MessageCircle, Archive } from "lucide-react"
import {
  getCustomer,
  updateCustomer,
  archiveCustomer,
  whatsappLink,
} from "@/api/customers"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatDate, formatCurrency } from "@/lib/formatters"

function Cell({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-sm font-semibold " +
          (tone === "bad" ? "text-rose-ink" : tone === "warn" ? "text-amber-ink" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  )
}

export function CustomerDetailSheet({
  customerId,
  onClose,
}: {
  customerId: string | null
  onClose: () => void
}) {
  const { t } = useT()
  const qc = useQueryClient()
  // A read-only clerk may look up a customer but not rewrite the book. The server
  // enforces this too; hiding the controls just stops the request being made at all.
  const { canWrite } = useRole()
  const [name, setName] = useState("")
  const [note, setNote] = useState("")
  const [confirmArchive, setConfirmArchive] = useState(false)

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => getCustomer(customerId!),
    enabled: !!customerId,
  })

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setNote(customer.note ?? "")
    }
  }, [customer])

  const save = useMutation({
    mutationFn: () => updateCustomer(customerId!, { name: name.trim(), note: note.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      qc.invalidateQueries({ queryKey: ["customer", customerId] })
      toast.success(t("customer_saved"))
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  const archive = useMutation({
    mutationFn: () => archiveCustomer(customerId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success(t("customer_archived"))
      setConfirmArchive(false)
      onClose()
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  const dirty = !!customer && (name.trim() !== customer.name || note.trim() !== (customer.note ?? ""))
  const s = customer?.stats

  return (
    <>
      <Sheet open={!!customerId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[460px] overflow-y-auto sm:max-w-[460px]">
          {isLoading || !customer || !s ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>{customer.name || t("walk_in_customer")}</SheetTitle>
              </SheetHeader>

              <div className="mt-1 text-sm text-muted-foreground" dir="ltr">
                {customer.phone}
              </div>

              <div className="mt-4 flex gap-2">
                {/* Both leave from the OWNER'S own phone and his own relationship. The
                    platform never contacts his customers — that is the promise that makes
                    him willing to type their numbers in at all. */}
                <Button asChild size="sm" className="flex-1 gap-1.5">
                  <a
                    href={whatsappLink(customer.phone, "")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t("customer_whatsapp")}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="h-3.5 w-3.5" />
                    {t("customer_call")}
                  </a>
                </Button>
              </div>

              <div className="my-5 h-px bg-border" />

              <div className="grid grid-cols-3 gap-4">
                <Cell label={t("stat_visits")} value={String(s.attended)} />
                <Cell label={t("stat_upcoming")} value={String(s.upcoming)} />
                <Cell
                  label={t("stat_no_shows")}
                  value={s.noShow > 0 ? `${s.noShow} (${s.noShowRate}%)` : "0"}
                  tone={s.isUnreliable ? "bad" : s.noShow > 0 ? "warn" : undefined}
                />
                <Cell label={t("stat_via_counter")} value={String(s.viaCounter)} />
                <Cell label={t("stat_via_app")} value={String(s.viaApp)} />
                <Cell label={t("stat_cancelled")} value={String(s.cancelled)} />
                <Cell
                  label={t("stat_last_visit")}
                  value={s.lastVisit ? formatDate(s.lastVisit) : t("customer_never_visited")}
                />
                <Cell
                  label={t("stat_customer_since")}
                  value={s.customerSince ? formatDate(s.customerSince) : "—"}
                />
                <Cell
                  label={t("stat_owed")}
                  value={s.amountOwed > 0 ? formatCurrency(s.amountOwed) : "—"}
                  tone={s.amountOwed > 0 ? "warn" : undefined}
                />
              </div>

              <div className="my-5 h-px bg-border" />

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("customer_name")}
                  </span>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("customer_note_label")}
                  </span>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("customer_note_placeholder")}
                    disabled={!canWrite}
                  />
                </label>
                {canWrite && (
                  <Button
                    size="sm"
                    disabled={!dirty || save.isPending}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
                    {t("save")}
                  </Button>
                )}
              </div>

              <div className="my-5 h-px bg-border" />

              <div className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {t("customer_recent_bookings")}
              </div>
              <div className="mt-2 space-y-1.5">
                {customer.recentBookings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">—</div>
                ) : (
                  customer.recentBookings.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{b.venueName}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(b.date)}
                          {b.startTime ? ` · ${b.startTime}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {b.amountPaid + 0.001 < b.totalAmount && b.status !== "cancelled" && (
                          <span className="rounded-full bg-amber-tint px-2 py-0.5 text-[10px] font-semibold text-amber-ink">
                            {formatCurrency(b.totalAmount - b.amountPaid)}
                          </span>
                        )}
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="my-5 h-px bg-border" />

              {canWrite && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmArchive(true)}
                >
                  <Archive className="me-1.5 h-3.5 w-3.5" />
                  {t("customer_archive")}
                </Button>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("customer_archive")}
        description={t("customer_archive_confirm").replace("{name}", customer?.name ?? "")}
        confirmLabel={t("customer_archive")}
        variant="destructive"
        isLoading={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
    </>
  )
}

export default CustomerDetailSheet
