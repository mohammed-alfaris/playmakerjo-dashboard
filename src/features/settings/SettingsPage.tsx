import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Percent,
  Power,
  PowerOff,
  Smartphone,
  Loader2,
  Save,
  AlertTriangle,
  Wrench,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { getSettings, updateSettings, type PlatformSettings } from "@/api/settings"

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────── */

function fmtUpdatedAt(iso: string | undefined, lang: "en" | "ar") {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/* ─────────────────────────────────────────────────────────────────────────
   Toggle — styled button (no Switch primitive in shadcn set)
   ────────────────────────────────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  labelOn,
  labelOff,
  danger,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  labelOn: string
  labelOff: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        checked
          ? danger
            ? "bg-rose-500/90"
            : "bg-primary"
          : "bg-muted"
      )}
      title={checked ? labelOn : labelOff}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5 rtl:-translate-x-0.5"
        )}
      />
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Phone preview — renders the maintenance screen the mobile app will show
   ────────────────────────────────────────────────────────────────────── */

function MaintenancePhonePreview({
  active,
  messageEn,
  messageAr,
  previewLang,
  onToggleLang,
}: {
  active: boolean
  messageEn: string
  messageAr: string
  previewLang: "en" | "ar"
  onToggleLang: () => void
}) {
  const { t } = useT()
  const message = previewLang === "ar" ? messageAr : messageEn
  const dir = previewLang === "ar" ? "rtl" : "ltr"

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          <span>{t("maintenance_preview")}</span>
        </div>
        <button
          type="button"
          onClick={onToggleLang}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {previewLang === "en" ? "عربي" : "English"}
        </button>
      </div>

      {/* Phone frame */}
      <div className="mx-auto w-full max-w-[240px]">
        <div className="relative rounded-[2.25rem] border border-border bg-zinc-950 p-2 shadow-2xl">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-zinc-950" />

          <div
            dir={dir}
            className={cn(
              "relative flex min-h-[420px] flex-col items-center justify-center rounded-[1.75rem] px-5 py-10 text-center",
              "bg-gradient-to-b",
              active
                ? "from-amber-950/40 via-zinc-900 to-zinc-950"
                : "from-emerald-950/30 via-zinc-900 to-zinc-950"
            )}
          >
            {/* Logo-ish mark */}
            <div
              className={cn(
                "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg",
                active ? "bg-amber-500/15 ring-1 ring-amber-500/40" : "bg-primary/10 ring-1 ring-primary/30"
              )}
            >
              {active ? (
                <Wrench className="h-8 w-8 text-amber-400" />
              ) : (
                <Power className="h-8 w-8 text-primary" />
              )}
            </div>

            <p
              className={cn(
                "mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
                active ? "text-amber-400" : "text-primary"
              )}
            >
              {active
                ? previewLang === "ar"
                  ? "قيد الصيانة"
                  : "Under maintenance"
                : previewLang === "ar"
                  ? "نشط"
                  : "Live"}
            </p>

            <h4 className="mb-3 text-base font-semibold text-white">PlayMaker JO</h4>

            <p className="text-[13px] leading-relaxed text-zinc-300">
              {active
                ? (message?.trim() ||
                    (previewLang === "ar"
                      ? "التطبيق متوقف مؤقتًا للصيانة."
                      : "The app is temporarily unavailable."))
                : previewLang === "ar"
                  ? "كل شيء يعمل بشكل طبيعي."
                  : "Everything is running normally."}
            </p>

            {active && (
              <button
                type="button"
                className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/15"
              >
                <RefreshCw className="h-3 w-3" />
                {previewLang === "ar" ? "إعادة المحاولة" : "Try again"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Settings page
   ────────────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const { t, lang } = useT()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  })

  const settings: PlatformSettings | undefined = data?.data

  // Local form state — hydrated from query
  const [fee, setFee] = useState<string>("")
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [msgEn, setMsgEn] = useState("")
  const [msgAr, setMsgAr] = useState("")
  const [previewLang, setPreviewLang] = useState<"en" | "ar">(lang)

  useEffect(() => {
    if (!settings) return
    setFee(String(settings.platformFeePercentage))
    setMaintenanceMode(settings.maintenanceMode)
    setMsgEn(settings.maintenanceMessageEn)
    setMsgAr(settings.maintenanceMessageAr)
  }, [settings])

  useEffect(() => {
    setPreviewLang(lang)
  }, [lang])

  // Dirty check so "Save" button is a real action
  const isDirty = useMemo(() => {
    if (!settings) return false
    const feeNum = parseFloat(fee)
    return (
      (!isNaN(feeNum) && feeNum !== settings.platformFeePercentage) ||
      maintenanceMode !== settings.maintenanceMode ||
      msgEn !== settings.maintenanceMessageEn ||
      msgAr !== settings.maintenanceMessageAr
    )
  }, [settings, fee, maintenanceMode, msgEn, msgAr])

  const feeNum = parseFloat(fee)
  const feeValid = !isNaN(feeNum) && feeNum >= 0 && feeNum <= 100

  const saveMutation = useMutation({
    mutationFn: () =>
      updateSettings({
        platformFeePercentage: feeValid ? feeNum : undefined,
        maintenanceMode,
        maintenanceMessageEn: msgEn,
        maintenanceMessageAr: msgAr,
      }),
    onSuccess: (res) => {
      toast.success(res.message || t("settings_saved"))
      qc.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: () => {
      toast.error(t("settings_save_failed"))
    },
  })

  // Fast toggle — apply maintenance mode immediately (no "save" needed)
  const maintenanceMutation = useMutation({
    mutationFn: (enabled: boolean) => updateSettings({ maintenanceMode: enabled }),
    onSuccess: (_res, enabled) => {
      toast.success(enabled ? t("maintenance_enabled") : t("maintenance_disabled"))
      qc.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: () => toast.error(t("settings_save_failed")),
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight font-display">
            {t("nav_settings")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("settings_subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{t("last_updated")}:</span>
          <span className="font-medium text-foreground">
            {fmtUpdatedAt(settings?.updatedAt, lang)}
          </span>
        </div>
      </div>

      {/* Status strip */}
      <div
        className={cn(
          "rounded-2xl border p-4 transition-colors",
          maintenanceMode
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-emerald-500/30 bg-emerald-500/5"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                maintenanceMode ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"
              )}
            >
              {maintenanceMode ? <Wrench className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {maintenanceMode ? t("maintenance_status_on") : t("maintenance_status_off")}
              </p>
              <p className="text-xs text-muted-foreground">
                {maintenanceMode ? t("maintenance_status_on_hint") : t("maintenance_status_off_hint")}
              </p>
            </div>
          </div>
          <Button
            variant={maintenanceMode ? "default" : "outline"}
            size="sm"
            disabled={maintenanceMutation.isPending || isLoading}
            onClick={() => {
              const next = !maintenanceMode
              setMaintenanceMode(next)
              maintenanceMutation.mutate(next)
            }}
          >
            {maintenanceMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : maintenanceMode ? (
              <>
                <PowerOff className="h-4 w-4" />
                {t("turn_off")}
              </>
            ) : (
              <>
                <Power className="h-4 w-4" />
                {t("turn_on")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Grid: Settings cards + phone preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — two settings cards */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card: Platform & Fees */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <header className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Percent className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{t("platform_fees_title")}</h2>
                <p className="text-xs text-muted-foreground">{t("platform_fees_subtitle")}</p>
              </div>
            </header>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fee">{t("platform_fee_percentage")}</Label>
                  <div className="relative">
                    <Input
                      id="fee"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.1"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      disabled={isLoading}
                      className="pe-9"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                  {!feeValid && fee !== "" && (
                    <p className="text-xs text-rose-500">{t("fee_range_hint")}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{t("platform_fee_hint")}</p>
                </div>

                <div className="space-y-2">
                  <Label>{t("owner_receives")}</Label>
                  <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium">
                    {feeValid ? (100 - feeNum).toFixed(1) : "—"}%
                  </div>
                  <p className="text-xs text-muted-foreground">{t("owner_share_hint")}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Card: Maintenance mode */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <header className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  maintenanceMode ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"
                )}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold">{t("maintenance_title")}</h2>
                <p className="text-xs text-muted-foreground">{t("maintenance_subtitle")}</p>
              </div>
              <Toggle
                checked={maintenanceMode}
                onChange={(v) => {
                  setMaintenanceMode(v)
                  maintenanceMutation.mutate(v)
                }}
                labelOn={t("turn_off")}
                labelOff={t("turn_on")}
                danger
              />
            </header>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="msgEn">{t("maintenance_message_en")}</Label>
                <textarea
                  id="msgEn"
                  dir="ltr"
                  rows={3}
                  value={msgEn}
                  onChange={(e) => setMsgEn(e.target.value)}
                  placeholder={t("maintenance_message_en_placeholder")}
                  disabled={isLoading}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="msgAr">{t("maintenance_message_ar")}</Label>
                <textarea
                  id="msgAr"
                  dir="rtl"
                  rows={3}
                  value={msgAr}
                  onChange={(e) => setMsgAr(e.target.value)}
                  placeholder={t("maintenance_message_ar_placeholder")}
                  disabled={isLoading}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>

              <p className="text-xs text-muted-foreground">{t("maintenance_message_hint")}</p>
            </div>
          </section>

          {/* Save bar */}
          <div
            className={cn(
              "sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-5 py-3 backdrop-blur shadow-sm transition-opacity",
              isDirty ? "opacity-100 border-primary/40" : "opacity-70 border-border"
            )}
          >
            <p className="text-xs text-muted-foreground">
              {isDirty ? t("unsaved_changes") : t("all_changes_saved")}
            </p>
            <Button
              disabled={!isDirty || !feeValid || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("save_changes")}
            </Button>
          </div>
        </div>

        {/* Right column — phone preview */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border border-border bg-card p-5">
            <MaintenancePhonePreview
              active={maintenanceMode}
              messageEn={msgEn}
              messageAr={msgAr}
              previewLang={previewLang}
              onToggleLang={() => setPreviewLang((v) => (v === "en" ? "ar" : "en"))}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
