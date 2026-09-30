import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Pencil, Plus, Power, Sparkles, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { FEATURE_ICONS, featureIcon } from "@/lib/featureIcons"
import {
  createVenueFeature, deleteVenueFeature, getVenueFeatures, updateVenueFeature,
  type VenueFeature, type VenueFeaturePayload,
} from "@/api/venueFeatures"

type ApiError = { response?: { status?: number; data?: { message?: string } } }

/**
 * The catalog of ready-made venue features. super_admin only.
 *
 * Owners pick from this when describing a venue, and players filter by it in the app. A
 * feature in use cannot be deleted — the API refuses with 409 so it is never silently
 * stripped from venues — and this page offers to deactivate it instead, which hides it
 * from new venues while the ones that chose it keep it.
 */
export default function VenueFeaturesPage() {
  const { t } = useT()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["venue-features", "admin"],
    queryFn: () => getVenueFeatures({ includeInactive: true }),
  })
  const features: VenueFeature[] = data?.data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<VenueFeature | null>(null)
  const [name, setName] = useState("")
  const [nameAr, setNameAr] = useState("")
  const [icon, setIcon] = useState("")
  const [sortOrder, setSortOrder] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<VenueFeature | null>(null)

  // Invalidating the prefix also refreshes the owner picker's ["venue-features"] query.
  const refresh = () => qc.invalidateQueries({ queryKey: ["venue-features"] })
  const serverMessage = (e: unknown) => (e as ApiError)?.response?.data?.message

  const createMut = useMutation({
    mutationFn: createVenueFeature,
    onSuccess: () => { toast.success(t("feature_created")); refresh(); setDialogOpen(false) },
    onError: (e) => toast.error(serverMessage(e) || t("feature_save_failed")),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: VenueFeaturePayload & { id: string }) => updateVenueFeature(id, payload),
    onSuccess: () => { toast.success(t("feature_updated")); refresh(); setDialogOpen(false) },
    onError: (e) => toast.error(serverMessage(e) || t("feature_save_failed")),
  })

  const deleteMut = useMutation({
    mutationFn: (f: VenueFeature) => deleteVenueFeature(f.id),
    onSuccess: () => { toast.success(t("feature_deleted")); refresh(); setDeleteTarget(null) },
    onError: (e, f) => {
      setDeleteTarget(null)
      if ((e as ApiError)?.response?.status === 409) {
        toast.error(serverMessage(e) || t("feature_save_failed"), {
          action: { label: t("feature_deactivate"), onClick: () => updateMut.mutate({ id: f.id, isActive: false }) },
        })
        return
      }
      toast.error(serverMessage(e) || t("feature_save_failed"))
    },
  })

  const openCreate = useCallback(() => {
    setEditing(null)
    setName("")
    setNameAr("")
    setIcon("")
    setSortOrder("")
    setDialogOpen(true)
  }, [])

  const openEdit = useCallback((f: VenueFeature) => {
    setEditing(f)
    setName(f.name)
    setNameAr(f.nameAr)
    setIcon(f.icon)
    setSortOrder(String(f.sortOrder))
    setDialogOpen(true)
  }, [])

  const canSave = name.trim() !== "" && nameAr.trim() !== "" && icon !== ""
  const isSaving = createMut.isPending || updateMut.isPending

  const save = () => {
    if (!canSave) return
    const payload: VenueFeaturePayload = {
      name: name.trim(),
      nameAr: nameAr.trim(),
      icon,
      ...(sortOrder.trim() !== "" && !Number.isNaN(Number(sortOrder)) ? { sortOrder: Number(sortOrder) } : {}),
    }
    if (editing) updateMut.mutate({ id: editing.id, ...payload })
    else createMut.mutate(payload)
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="display text-2xl font-semibold tracking-tight text-ink">{t("nav_venue_features")}</h1>
            <p className="mt-1 text-sm text-ink-3">{t("venue_features_subtitle")}</p>
          </div>
          <Button onClick={openCreate} className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            {t("add_feature")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
          </div>
        ) : features.length === 0 ? (
          <div className="rounded-2xl bg-card py-12 text-center text-sm text-ink-3 shadow-stadium-sm">
            {t("no_features")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = featureIcon(f.icon)
              return (
                <div
                  key={f.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-stadium-sm",
                    !f.isActive && "opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="chip-brand flex h-10 w-10 flex-none items-center justify-center rounded-xl">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-ink">{f.name}</span>
                        {!f.isActive && (
                          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-3">
                            {t("feature_inactive")}
                          </span>
                        )}
                      </div>
                      <div dir="rtl" className="truncate text-start text-[13px] text-ink-2">{f.nameAr}</div>
                      <div className="mt-1 text-[11px] text-ink-3">
                        {t("feature_used_by").replace("{count}", String(f.venueCount ?? 0))}
                      </div>
                    </div>
                  </div>
                  <div className="hair" />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 flex-1 gap-1 text-[11px] font-medium text-ink-2 hover:text-ink"
                      onClick={() => updateMut.mutate({ id: f.id, isActive: !f.isActive })}
                    >
                      <Power className="h-3 w-3" />
                      {f.isActive ? t("feature_deactivate") : t("feature_activate")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-ink-3 hover:text-ink"
                      onClick={() => openEdit(f)}
                      aria-label={t("edit_feature")}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-ink-3 hover:text-rose"
                      onClick={() => setDeleteTarget(f)}
                      aria-label={t("delete_feature")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="display flex items-center gap-2 tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" />
              {editing ? t("edit_feature") : t("create_feature")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("feature_name_en")}>
                <TextInput dir="ltr" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={t("feature_name_ar")}>
                <TextInput dir="rtl" value={nameAr} maxLength={60} onChange={(e) => setNameAr(e.target.value)} />
              </Field>
            </div>
            <Field label={t("feature_icon")}>
              <div className="grid grid-cols-6 gap-2">
                {FEATURE_ICONS.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    title={key}
                    aria-label={key}
                    aria-pressed={icon === key}
                    onClick={() => setIcon(key)}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg border transition-colors",
                      icon === key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-surface-2 text-ink-2 hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t("feature_sort_order")} className="max-w-[140px]">
              <TextInput type="number" dir="ltr" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={save}
              disabled={!canSave || isSaving}
              className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? t("save_changes") : t("create_feature")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("delete_feature")}
        description={t("delete_feature_confirm")}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
        isLoading={deleteMut.isPending}
      />
    </>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-lg bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-primary",
        props.className,
      )}
    />
  )
}
