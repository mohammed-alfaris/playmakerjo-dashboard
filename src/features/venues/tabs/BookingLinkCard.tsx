import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Copy, Download, ExternalLink, QrCode } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useT } from "@/i18n/LanguageContext"
import type { Venue } from "@/api/venues"

/** Where the public site lives. The link is what players open; the QR is what gets printed. */
const SITE = "https://playmakerjo.com"

/**
 * The venue's public booking link and its QR code: players book from it without the app —
 * a request the venue confirms, or paying the deposit by CliQ now. The owner shares the link on
 * WhatsApp and Instagram and prints the QR for the venue's wall.
 */
export function BookingLinkCard({ venue }: { venue: Venue }) {
  const { t } = useT()
  const url = `${SITE}/v/${venue.slug ?? venue.id}`
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M" })
      .then((data) => { if (live) setQr(data) })
      .catch(() => { if (live) setQr(null) })
    return () => { live = false }
  }, [url])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("copied"))
    } catch {
      // The link is on screen and selectable either way.
      toast.error(t("copy_failed"))
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-2">
        {qr ? <img src={qr} alt={t("booking_link_qr")} className="h-full w-full" /> : <QrCode className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-[12.5px] text-[hsl(var(--ink-2))]">{t("booking_link_explain")}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" dir="ltr"
          className="block truncate font-medium text-[13px] text-[hsl(var(--brand-ink))] hover:underline">
          {url.replace("https://", "")}
        </a>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={copy}>
            <Copy className="h-3.5 w-3.5" />
            {t("copy")}
          </Button>
          {qr && (
            <Button size="sm" variant="outline" className="gap-1" asChild>
              <a href={qr} download={`playmakerjo-${venue.slug ?? venue.id}-qr.png`}>
                <Download className="h-3.5 w-3.5" />
                {t("booking_link_download_qr")}
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("booking_link_open")}
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
