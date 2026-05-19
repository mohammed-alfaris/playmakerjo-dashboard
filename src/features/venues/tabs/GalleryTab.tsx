import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useT } from "@/i18n/LanguageContext"

// ---------------------------------------------------------------------------
// Gallery tab — image grid with lightbox
// ---------------------------------------------------------------------------

export function GalleryTab({
  images,
  onOpen,
}: {
  images: string[]
  onOpen: (i: number) => void
}) {
  const { t } = useT()
  if (images.length === 0) {
    return (
      <div className="rounded-[14px] bg-card border border-[hsl(var(--line))] p-8 text-center text-sm text-[hsl(var(--ink-3))]">
        {t("profile_no_gallery")}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {images.map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className="aspect-[4/3] rounded-[12px] overflow-hidden bg-[hsl(var(--surface-2))] group relative"
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = "none"
            }}
          />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lightbox overlay
// ---------------------------------------------------------------------------

export function Lightbox({
  src,
  onClose,
  onPrev,
  onNext,
}: {
  src: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute top-5 right-5 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {onPrev && (
        <button
          type="button"
          className="absolute left-5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          className="absolute right-5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 inline-flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          aria-label="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
      <img
        src={src}
        alt=""
        className="max-w-full max-h-full rounded-lg shadow-lg-stadium"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
