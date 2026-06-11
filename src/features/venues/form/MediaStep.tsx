import { useRef, useState } from "react"
import type { UseFormRegister } from "react-hook-form"
import { ImagePlus, X } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"
import { MAX_IMAGES, MAX_IMAGE_BYTES, type FormValues } from "./venueFormSchema"

interface MediaStepProps {
  images: string[]
  setImages: React.Dispatch<React.SetStateAction<string[]>>
  register: UseFormRegister<FormValues>
}

export function MediaStep({ images, setImages, register }: MediaStepProps) {
  const { t } = useT()

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, setIsUploading] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      toast.error(t("max_images_error"))
      return
    }
    const selected: File[] = []
    for (const file of Array.from(files).slice(0, remaining)) {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t("image_too_large"))
        continue
      }
      selected.push(file)
    }
    if (selected.length === 0) return
    setIsUploading(true)
    try {
      const { uploadFile } = await import("@/api/uploads")
      const urls = await Promise.all(
        selected.map((file) => uploadFile(file, "venue"))
      )
      setImages((prev) => [...prev, ...urls])
    } catch (err) {
      console.error("Upload failed:", err)
      toast.error(t("upload_image_failed"))
    } finally {
      setIsUploading(false)
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
    if (files.length) handleFiles(files)
  }

  const slotsLeft = MAX_IMAGES - images.length

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          {t("images")} <span className="text-muted-foreground">({t("optional")} · max {MAX_IMAGES})</span>
        </Label>

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative group aspect-video rounded-md overflow-hidden bg-muted">
                <img src={src} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                    Cover
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {images.length < MAX_IMAGES && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = "" }}
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/40"
              )}
            >
              <ImagePlus className="h-7 w-7 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t("click_drag_images")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PNG, JPG, WEBP · {slotsLeft} {slotsLeft === 1 ? "slot" : "slots"} remaining
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="latitude">
            {t("latitude")} <span className="text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input id="latitude" type="number" step="any" placeholder="31.9819" {...register("latitude")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="longitude">
            {t("longitude")} <span className="text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input id="longitude" type="number" step="any" placeholder="35.8718" {...register("longitude")} />
        </div>
      </div>
    </div>
  )
}
