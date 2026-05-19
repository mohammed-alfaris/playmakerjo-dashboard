import { useNavigate } from "react-router-dom"
import {
  Pencil,
  MapPin,
  CalendarCheck,
  Star,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Chip } from "@/components/shared/design/Chip"
import { useT } from "@/i18n/LanguageContext"
import { cn } from "@/lib/utils"
import type { Venue } from "@/api/venues"

// ---------------------------------------------------------------------------
// VenueHero — identity panel + cover image with thumbnail strip
// ---------------------------------------------------------------------------

export function VenueHero({
  venue,
  images,
  coverIdx,
  onCoverChange,
  avgRating,
  reviewsTotal,
  onEdit,
  onShowAllImages,
}: {
  venue: Venue
  images: string[]
  coverIdx: number
  onCoverChange: (i: number) => void
  avgRating: number
  reviewsTotal: number
  onEdit: () => void
  onShowAllImages: () => void
}) {
  const { t } = useT()
  const navigate = useNavigate()
  const sportsChips = venue.sports ?? []
  const primaryImage = images[coverIdx] ?? images[0]

  return (
    <div
      className="grid gap-5 rounded-[20px] bg-card border border-[hsl(var(--line))] shadow-md-stadium overflow-hidden"
      style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.8fr)" }}
    >
      {/* Left: identity */}
      <div className="p-6 md:p-8 flex flex-col gap-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={venue.status} />
          {sportsChips.slice(0, 4).map((s) => (
            <Chip key={s} color="brand" size="sm">
              <span className="capitalize">{s}</span>
            </Chip>
          ))}
          {sportsChips.length > 4 && (
            <Chip color="slate" size="sm">
              +{sportsChips.length - 4}
            </Chip>
          )}
          {reviewsTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-[hsl(var(--ink-2))]">
              <Star className="h-3 w-3 text-[hsl(var(--amber))]" fill="currentColor" />
              <span className="font-semibold">{avgRating.toFixed(1)}</span>
              <span className="text-[hsl(var(--ink-3))]">· {reviewsTotal}</span>
            </span>
          )}
        </div>
        <h1 className="display text-[30px] md:text-[36px] font-semibold tracking-[-0.02em] text-[hsl(var(--ink))] leading-[1.05]">
          {venue.name}
        </h1>
        <div className="flex items-start gap-1.5 text-[13px] text-[hsl(var(--ink-2))]">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--ink-3))]" />
          <span className="min-w-0">
            {venue.city}
            {venue.address ? ` · ${venue.address}` : ""}
          </span>
        </div>
        {venue.description && (
          <p className="text-[13px] text-[hsl(var(--ink-2))] leading-relaxed max-w-[60ch]">
            {venue.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
          <Button size="sm" variant="outline" onClick={onEdit} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            {t("profile_edit")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate(`/timeline?venue=${venue.id}`)}
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            {t("profile_view_timeslots")}
          </Button>
          {venue.latitude != null && venue.longitude != null && (
            <Button size="sm" variant="ghost" asChild className="gap-1.5">
              <a
                href={`https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin className="h-3.5 w-3.5" />
                {t("profile_open_in_maps")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Right: cover + thumbnails */}
      <div className="relative bg-[hsl(var(--surface-2))] min-h-[240px]">
        {primaryImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(90deg, hsl(var(--card)) 0%, transparent 30%), url(${primaryImage})`,
            }}
            role="img"
            aria-label={venue.name}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--ink-3))]">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
            {images.slice(0, 3).map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onCoverChange(i)}
                className={cn(
                  "h-11 w-11 rounded-md bg-cover bg-center border-2 transition-colors",
                  i === coverIdx
                    ? "border-[hsl(var(--brand))]"
                    : "border-white/60 hover:border-white",
                )}
                style={{ backgroundImage: `url(${src})` }}
                aria-label={`Cover ${i + 1}`}
              />
            ))}
            {images.length > 3 && (
              <button
                type="button"
                onClick={onShowAllImages}
                className="h-11 w-11 rounded-md bg-black/70 text-white text-[11px] font-semibold flex items-center justify-center"
              >
                +{images.length - 3}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
