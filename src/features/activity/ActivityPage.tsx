import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { getActivity } from "@/api/activity"
import { getCompanies } from "@/api/companies"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRole } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import type { TranslationKey } from "@/i18n/translations"
import { localized } from "@/lib/inbox"
import { useViewAsStore } from "@/store/viewAsStore"

const AREAS = ["booking", "payment", "proof", "series", "block", "venue", "staff", "role", "user", "invoice", "company", "settings"] as const
const PAGE = 50

const selectClass =
  "h-9 rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm text-[hsl(var(--ink))] focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * Who did what, newest first. The owner reads their own company — "who cancelled Khalid's
 * Tuesday?", "who changed the price?"; the admin reads any company or the platform's own
 * changes. Entries are written with the change itself and never edited.
 */
export default function ActivityPage() {
  const { t, lang } = useT()
  const { isAdmin } = useRole()
  const viewAs = useViewAsStore((s) => s.companyId)
  const [company, setCompany] = useState<string>(viewAs ?? "")
  const [area, setArea] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const { data: companies } = useQuery({
    queryKey: ["companies", "activity-filter"],
    queryFn: () => getCompanies({ limit: 100 }),
    enabled: isAdmin,
  })

  const { data, isLoading } = useQuery({
    queryKey: ["activity", { company, area, from, to, limit }],
    queryFn: () => getActivity({
      owner_id: isAdmin && company ? company : undefined,
      area: area || undefined, from: from || undefined, to: to || undefined, limit,
    }),
  })
  const items = data?.data ?? []
  const total = data?.pagination?.total ?? 0

  const stamp = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Amman",
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_activity")} subtitle={t(isAdmin ? "activity_admin_subtitle" : "activity_subtitle")} />

      <div className="flex flex-wrap items-end gap-3">
        {isAdmin && (
          <label className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">{t("company")}</span>
            <select className={selectClass} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">{t("all")}</option>
              <option value="platform">{t("activity_platform")}</option>
              {(companies?.data ?? []).map((c) => <option key={c.id} value={c.id}>{(lang === "ar" && c.nameAr) || c.name}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">{t("activity_area")}</span>
          <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">{t("all")}</option>
            {AREAS.map((a) => <option key={a} value={a}>{t(`activity_area_${a}` as TranslationKey)}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">{t("block_from")}</span>
          <Input type="date" className="num h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">{t("block_to")}</span>
          <Input type="date" className="num h-9" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <div className="rounded-[14px] border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">…</p>}
        {!isLoading && items.length === 0 && (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><History className="h-4 w-4" />{t("activity_empty")}</p>
        )}
        <ul>
          {items.map((e) => (
            <li key={e.id} className="flex gap-4 border-b px-4 py-3 last:border-0">
              <span className="num w-28 shrink-0 pt-0.5 text-xs text-muted-foreground">{stamp.format(new Date(e.at))}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{localized(e.summary, lang)}</p>
                <p className="text-xs text-muted-foreground">
                  {e.actorName ?? t("activity_system")}
                  {e.actorRole && ` · ${t(`activity_role_${e.actorRole}` as TranslationKey)}`}
                  {isAdmin && e.companyName && ` · ${e.companyName}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {items.length < total && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>{t("activity_more")}</Button>
        </div>
      )}
    </div>
  )
}
