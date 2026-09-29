import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { UserCog, ShieldBan, ShieldCheck, KeyRound, SlidersHorizontal, Users, ShieldHalf } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { getStaff, updateStaffStatus, type StaffMember } from "@/api/staff"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { ResetPasswordFlow } from "@/components/shared/ResetPasswordFlow"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Tabs } from "@/components/shared/design/Tabs"
import { LimitedAddButton } from "@/components/shared/LimitedAddButton"
import { useMyCompany } from "@/hooks/useMyCompany"
import { Button } from "@/components/ui/button"
import { usePagination } from "@/hooks/usePagination"
import { useT } from "@/i18n/LanguageContext"
import { formatDate } from "@/lib/formatters"
import StaffFormDialog from "./StaffFormDialog"
import StaffAccessDialog from "./StaffAccessDialog"
import RolesPanel from "./RolesPanel"
import { useTeamLookups } from "./teamAccess"

type TeamTab = "staff" | "roles"

export default function StaffPage() {
  const { t, lang } = useT()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TeamTab>("staff")
  const [accessTarget, setAccessTarget] = useState<StaffMember | null>(null)
  const { venues } = useTeamLookups()
  const company = useMyCompany()
  const { page, limit, setPage } = usePagination()
  const [addOpen, setAddOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", page, limit],
    queryFn: () => getStaff({ page, limit }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "banned" }) =>
      updateStaffStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      qc.invalidateQueries({ queryKey: ["company"] })
      toast.success(t("staff_status_saved"))
    },
    // Reactivating can be refused when the team is at its limit; the server says why.
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t("something_went_wrong"))
    },
  })

  const columns: ColumnDef<StaffMember>[] = [
    {
      id: "person",
      header: t("name"),
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.original.name}</div>
          <div className="truncate text-xs text-muted-foreground" dir="ltr">
            {row.original.email}
          </div>
        </div>
      ),
    },
    {
      id: "phone",
      header: t("phone"),
      cell: ({ row }) => (
        // dir="ltr" so a +962 number is not mirrored in the Arabic UI.
        <span className="text-sm text-muted-foreground" dir="ltr">
          {row.original.phone || "—"}
        </span>
      ),
    },
    {
      id: "role",
      header: t("staff_role"),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.staffRole?.name ?? "—"}</span>
      ),
    },
    {
      id: "venues",
      header: t("staff_venues"),
      cell: ({ row }) => {
        const m = row.original
        if (m.allVenues !== false) {
          return <span className="text-sm text-muted-foreground">{t("staff_venues_all")}</span>
        }
        const names = (m.venueIds ?? [])
          .map((id) => venues.find((v) => v.id === id))
          .filter(Boolean)
          .map((v) => (lang === "ar" && v!.nameAr ? v!.nameAr : v!.name))
        return (
          <span className="block max-w-[220px] truncate text-sm" title={names.join(", ")}>
            {names.length ? names.join(", ") : t("staff_venues_count").replace("{count}", String(m.venueIds?.length ?? 0))}
          </span>
        )
      },
    },
    {
      id: "status",
      header: t("status"),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "joined",
      header: t("joined"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setAccessTarget(row.original)}>
            <SlidersHorizontal className="me-1.5 h-3.5 w-3.5" />
            {t("staff_edit_access")}
          </Button>
          {/* A locked-out clerk is the most common reason an owner has to contact the vendor.
              Offered whatever their status: resetting a suspended clerk's password is a
              normal step before bringing them back. */}
          <Button variant="ghost" size="sm" onClick={() => setResetTarget(row.original)}>
            <KeyRound className="me-1.5 h-3.5 w-3.5" />
            {t("reset_password")}
          </Button>
          {row.original.status === "active" ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => statusMutation.mutate({ id: row.original.id, status: "banned" })}
          >
            <ShieldBan className="me-1.5 h-3.5 w-3.5" />
            {t("staff_suspend")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => statusMutation.mutate({ id: row.original.id, status: "active" })}
          >
            <ShieldCheck className="me-1.5 h-3.5 w-3.5" />
            {t("activate")}
          </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav_staff")}
        subtitle={t("staff_subtitle")}
        action={
          tab === "staff" ? (
            <LimitedAddButton
              usage={company?.staff}
              usageLabel={t("usage_staff")}
              limitMessage={t("limit_reached_staff")}
              onClick={() => setAddOpen(true)}
            >
              {t("staff_add")}
            </LimitedAddButton>
          ) : undefined
        }
      />

      <Tabs<TeamTab>
        tabs={[
          { id: "staff", label: t("team_tab_staff"), icon: <Users className="h-3.5 w-3.5" /> },
          { id: "roles", label: t("team_tab_roles"), icon: <ShieldHalf className="h-3.5 w-3.5" /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "roles" ? (
        <RolesPanel />
      ) : isError ? (
        // A failed load must not look like an empty team — that would read as data loss.
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {t("something_went_wrong")}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          pagination={{ page, limit, total: data?.pagination?.total ?? 0 }}
          onPageChange={setPage}
          emptyMessage={t("staff_empty")}
          emptyIcon={UserCog}
        />
      )}

      <StaffFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <StaffAccessDialog member={accessTarget} onOpenChange={(open) => { if (!open) setAccessTarget(null) }} />

      <ResetPasswordFlow
        target={resetTarget}
        onOpenChange={(open) => { if (!open) setResetTarget(null) }}
      />
    </div>
  )
}
