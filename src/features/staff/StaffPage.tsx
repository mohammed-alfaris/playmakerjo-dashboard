import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { UserCog, ShieldBan, ShieldCheck } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  getStaff,
  updateStaffPermissions,
  updateStaffStatus,
  type StaffMember,
  type StaffPermission,
} from "@/api/staff"
import { DataTable } from "@/components/shared/DataTable"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePagination } from "@/hooks/usePagination"
import { useT } from "@/i18n/LanguageContext"
import { formatDate } from "@/lib/formatters"
import StaffFormDialog from "./StaffFormDialog"

export default function StaffPage() {
  const { t } = useT()
  const qc = useQueryClient()
  const { page, limit, setPage } = usePagination()
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff", page, limit],
    queryFn: () => getStaff({ page, limit }),
  })

  const permissionMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: StaffPermission }) =>
      updateStaffPermissions(id, permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      toast.success(t("staff_permission_updated"))
    },
    onError: () => toast.error(t("something_went_wrong")),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "banned" }) =>
      updateStaffStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] })
      toast.success(t("staff_status_saved"))
    },
    onError: () => toast.error(t("something_went_wrong")),
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
      id: "permissions",
      header: t("staff_permission"),
      cell: ({ row }) => (
        <Select
          value={row.original.permissions ?? "read"}
          onValueChange={(v) =>
            permissionMutation.mutate({ id: row.original.id, permissions: v as StaffPermission })
          }
        >
          <SelectTrigger className="h-8 w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="write">{t("staff_permission_write")}</SelectItem>
            <SelectItem value="read">{t("staff_permission_read")}</SelectItem>
          </SelectContent>
        </Select>
      ),
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
      cell: ({ row }) =>
        row.original.status === "active" ? (
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
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav_staff")}
        subtitle={t("staff_subtitle")}
        action={<Button onClick={() => setAddOpen(true)}>{t("staff_add")}</Button>}
      />

      {isError ? (
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
    </div>
  )
}
