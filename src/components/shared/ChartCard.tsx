import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  subtitle?: string
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  skeletonHeight?: number
  children: React.ReactNode
  className?: string
}

export function ChartCard({
  title,
  subtitle,
  isLoading,
  isError,
  errorMessage = "Failed to load chart data",
  skeletonHeight = 256,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="w-full rounded-md" style={{ height: skeletonHeight }} />
        ) : isError ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height: skeletonHeight }}
          >
            {errorMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
