import type { StaffRole } from "@/api/staff"
import type { Venue } from "@/api/venues"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"
import type { StaffAccessValue } from "./teamAccess"

/**
 * Role and venue scope for one clerk. "All venues" includes venues the owner opens later;
 * picking specific ones does not.
 */
export function StaffAccessFields({
  value,
  onChange,
  roles,
  venues,
  error,
}: {
  value: StaffAccessValue
  onChange: (next: StaffAccessValue) => void
  roles: StaffRole[]
  venues: Venue[]
  error?: string | null
}) {
  const { t, lang } = useT()

  function toggleVenue(id: string, on: boolean) {
    const ids = on ? [...value.venueIds, id] : value.venueIds.filter((v) => v !== id)
    onChange({ ...value, venueIds: ids })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("staff_role")}</Label>
        <Select value={value.staffRoleId} onValueChange={(id) => onChange({ ...value, staffRoleId: id })}>
          <SelectTrigger>
            <SelectValue placeholder={t("staff_role_pick")} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("staff_role_hint")}</p>
      </div>

      <div className="space-y-2">
        <Label>{t("staff_venues")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((all) => (
            <button
              key={String(all)}
              type="button"
              onClick={() => onChange({ ...value, allVenues: all })}
              className={cn(
                "rounded-lg border p-2.5 text-start text-sm transition-colors",
                value.allVenues === all ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/40",
              )}
            >
              {all ? t("staff_venues_all") : t("staff_venues_some")}
            </button>
          ))}
        </div>
        {value.allVenues ? (
          <p className="text-xs text-muted-foreground">{t("staff_venues_all_hint")}</p>
        ) : (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
            {venues.length === 0 && (
              <p className="p-1 text-xs text-muted-foreground">{t("staff_venues_none")}</p>
            )}
            {venues.map((v) => (
              <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-muted/40">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={value.venueIds.includes(v.id)}
                  onChange={(e) => toggleVenue(v.id, e.target.checked)}
                />
                <span className="truncate">{lang === "ar" && v.nameAr ? v.nameAr : v.name}</span>
              </label>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
