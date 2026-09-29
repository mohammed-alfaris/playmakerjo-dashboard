import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Building2, Loader2 } from "lucide-react"
import { updateMyCompany, type Company } from "@/api/companies"
import { UsageMeter } from "@/components/shared/UsageMeter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useMyCompany } from "@/hooks/useMyCompany"
import { useT } from "@/i18n/LanguageContext"

/** Owners only: the company's name, and how much of the allowance it uses. */
export function CompanyCard() {
  const company = useMyCompany()
  // Keyed so a refetch after saving starts the form from the saved names.
  return company ? <CompanyForm key={`${company.name}|${company.nameAr ?? ""}`} company={company} /> : null
}

function CompanyForm({ company }: { company: Company }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [name, setName] = useState(company.name)
  const [nameAr, setNameAr] = useState(company.nameAr ?? "")

  const mutation = useMutation({
    mutationFn: () => updateMyCompany({ name: name.trim(), nameAr: nameAr.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company"] })
      toast.success(t("company_saved"))
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t("something_went_wrong"))
    },
  })

  const dirty = name.trim() !== company.name || nameAr.trim() !== (company.nameAr ?? "")

  return (
    <section className="rounded-xl border bg-card p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Building2 className="h-4 w-4 text-brand" />
        {t("company_card_title")}
      </div>
      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UsageMeter label={t("usage_venues")} usage={company.venues} />
        <UsageMeter label={t("usage_staff")} usage={company.staff} />
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) mutation.mutate()
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">{t("company_name")}</Label>
            <Input id="company-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-name-ar">{t("company_name_ar")}</Label>
            <Input id="company-name-ar" dir="rtl" value={nameAr} maxLength={120} onChange={(e) => setNameAr(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("company_card_hint")}</p>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || !name.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("save_changes")}
          </Button>
        </div>
      </form>
    </section>
  )
}
