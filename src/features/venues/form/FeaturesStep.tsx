import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { getVenueFeatures, type VenueFeatureRef } from "@/api/venueFeatures"
import { featureIcon } from "@/lib/featureIcons"
import { addCustomLabel, MAX_CUSTOM_LABEL_LENGTH, MAX_CUSTOM_PER_VENUE } from "@/lib/venueFeatureRules"

interface FeaturesStepProps {
  featureIds: string[]
  setFeatureIds: React.Dispatch<React.SetStateAction<string[]>>
  customFeatures: string[]
  setCustomFeatures: React.Dispatch<React.SetStateAction<string[]>>
  /**
   * The venue's features as the API resolved them. Needed for one case the catalog list
   * cannot cover: a feature an admin has since retired is gone from the catalog, but the
   * venue still has it and the owner must still see — and be able to keep — it.
   */
  attached: VenueFeatureRef[]
}

/**
 * Pick what the venue offers from the admin's catalog, or type something that isn't there.
 * Catalog features carry an icon and players can filter by them; typed ones are shown as
 * typed, on this venue only.
 */
export function FeaturesStep({
  featureIds, setFeatureIds, customFeatures, setCustomFeatures, attached,
}: FeaturesStepProps) {
  const { t, lang } = useT()
  const [draft, setDraft] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["venue-features"],
    queryFn: () => getVenueFeatures(),
    staleTime: 5 * 60_000,
  })

  const options = useMemo(() => {
    const active = (data?.data ?? []).map((f) => ({ ...f, retired: false }))
    const activeIds = new Set(active.map((f) => f.id))
    const retired = attached
      .filter((f) => !activeIds.has(f.id))
      .map((f) => ({ ...f, retired: true }))
    return [...active, ...retired]
  }, [data, attached])

  const label = (f: { name: string; nameAr: string }) => (lang === "ar" ? f.nameAr || f.name : f.name)

  function toggle(id: string) {
    setFeatureIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function addDraft() {
    const result = addCustomLabel(draft, customFeatures, options)
    switch (result.kind) {
      case "empty":
        return
      case "too_long":
        toast.error(t("features_too_long"))
        return
      case "too_many":
        toast.error(t("features_too_many"))
        return
      case "duplicate":
        toast.error(t("features_duplicate"))
        return
      case "catalog":
        setFeatureIds((ids) => (ids.includes(result.id) ? ids : [...ids, result.id]))
        toast.info(t("features_matched_catalog"))
        break
      case "custom":
        setCustomFeatures((c) => [...c, result.label])
        break
    }
    setDraft("")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>{t("venue_features")}</Label>
        <p className="text-xs text-muted-foreground">{t("features_from_catalog_hint")}</p>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {options.map((f) => {
              const Icon = featureIcon(f.icon)
              const selected = featureIds.includes(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label(f)}
                  {f.retired && (
                    <span className="ms-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                      {t("features_retired")}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-feature">{t("features_add_own")}</Label>
        <p className="text-xs text-muted-foreground">{t("features_custom_hint")}</p>
        <div className="flex gap-2">
          <Input
            id="custom-feature"
            value={draft}
            maxLength={MAX_CUSTOM_LABEL_LENGTH}
            placeholder={t("features_add_own_placeholder")}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // The wizard turns Enter into "next step". Here Enter means "add this".
              if (e.key === "Enter") {
                e.preventDefault()
                e.stopPropagation()
                addDraft()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addDraft}
            disabled={customFeatures.length >= MAX_CUSTOM_PER_VENUE && draft.trim() === ""}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            {t("features_add")}
          </Button>
        </div>
        {customFeatures.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {customFeatures.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-[12.5px] text-foreground"
              >
                {c}
                <button
                  type="button"
                  onClick={() => setCustomFeatures((list) => list.filter((x) => x !== c))}
                  aria-label={`${t("features_remove")} ${c}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {customFeatures.length} / {MAX_CUSTOM_PER_VENUE}
        </p>
      </div>
    </div>
  )
}
