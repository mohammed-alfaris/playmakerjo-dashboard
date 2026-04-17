import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSummary } from "@/api/reports"
import { useOwnerFilter } from "@/hooks/useRole"
import { useT } from "@/i18n/LanguageContext"
import { formatCurrency } from "@/lib/formatters"

/**
 * Monthly revenue-vs-target gauge. Target stored in localStorage per user until
 * Phase 2 ships /reports/targets backend. Keyed by owner_id so admin and each
 * owner have their own target.
 */
function targetKey(ownerId?: string): string {
  return `revenue-target:${ownerId ?? "admin"}`
}

function useStoredTarget(ownerId?: string) {
  const key = targetKey(ownerId)
  const [target, setTargetState] = useState<number>(() => {
    if (typeof window === "undefined") return 10000
    const stored = window.localStorage.getItem(key)
    return stored ? Number(stored) || 10000 : 10000
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(key)
    setTargetState(stored ? Number(stored) || 10000 : 10000)
  }, [key])

  function setTarget(value: number) {
    setTargetState(value)
    window.localStorage.setItem(key, String(value))
  }

  return { target, setTarget }
}

export function RevenueTargetGauge() {
  const ownerFilter = useOwnerFilter()
  const { t } = useT()
  const { target, setTarget } = useStoredTarget(ownerFilter.owner_id)
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState("")

  const { data } = useQuery({
    queryKey: ["dashboard-summary", ownerFilter],
    queryFn: () => getSummary(ownerFilter),
  })
  const achieved = data?.data?.totalRevenue ?? 0
  const percent = target > 0 ? Math.min(100, (achieved / target) * 100) : 0
  const remaining = Math.max(0, target - achieved)

  // SVG gauge geometry
  const size = 168
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = radius * 2 * Math.PI
  const dash = (percent / 100) * circumference

  function handleSave() {
    const n = Number(draft)
    if (!Number.isFinite(n) || n <= 0) return
    setTarget(n)
    setEditOpen(false)
  }

  return (
    <div className="relative flex flex-col items-center gap-2 rounded-xl bg-card p-5 h-full">
      <div className="flex w-full items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t("monthly_target")}</p>
          <p className="text-xs text-muted-foreground">{t("this_month")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setDraft(String(target))
            setEditOpen(true)
          }}
          aria-label={t("edit_target")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      <svg width={size} height={size} className="my-2">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--primary-container))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dasharray] duration-500 ease-kinetic"
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground font-display"
          fontSize="28"
          fontWeight="600"
        >
          {Math.round(percent)}%
        </text>
      </svg>

      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          {formatCurrency(achieved)}
          <span className="text-muted-foreground font-normal"> / {formatCurrency(target)}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(remaining)} {t("remaining")}
        </p>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("edit_target")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="target-input">{t("monthly_target")} (JOD)</Label>
            <Input
              id="target-input"
              type="number"
              inputMode="numeric"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
