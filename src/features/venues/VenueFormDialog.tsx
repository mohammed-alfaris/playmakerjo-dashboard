import { useEffect, useRef, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Check, ImagePlus, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { createVenue, updateVenue, type Venue } from "@/api/venues"
import { getUsers } from "@/api/users"
import { useRole } from "@/hooks/useRole"
import { SPORTS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useT } from "@/i18n/LanguageContext"

const MAX_IMAGES = 5

const schema = z.object({
  name:         z.string().min(2, "Name must be at least 2 characters"),
  ownerId:      z.string().min(1, "Owner is required"),
  city:         z.string().min(2, "City is required"),
  address:      z.string().min(5, "Address must be at least 5 characters"),
  sports:       z.array(z.string()).min(1, "Select at least one sport"),
  pricePerHour: z.number({ error: "Enter a valid price" }).positive("Price must be positive"),
  description:  z.string().optional(),
  latitude:     z.string().optional(),
  longitude:    z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface VenueFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venue?: Venue | null
  onSuccess?: () => void
}

export function VenueFormDialog({ open, onOpenChange, venue, onSuccess }: VenueFormDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!venue
  const { isOwner, userId } = useRole()
  const { t, lang } = useT()

  const [images, setImages]         = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: usersData } = useQuery({
    queryKey: ["users-owners"],
    queryFn: () => getUsers({ role: "venue_owner", limit: 100 }),
    enabled: open,
  })
  const owners: Array<{ id: string; name: string }> = usersData?.data ?? []

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      setImages(venue?.images ?? [])
      reset(
        venue
          ? {
              name:         venue.name,
              ownerId:      venue.owner.id,
              city:         venue.city,
              address:      venue.address,
              sports:       venue.sports,
              pricePerHour: venue.pricePerHour,
              description:  venue.description ?? "",
              latitude:     venue.latitude?.toString()  ?? "",
              longitude:    venue.longitude?.toString() ?? "",
            }
          : {
              name: "", ownerId: isOwner && userId ? userId : "", city: "", address: "",
              sports: [], pricePerHour: 0, description: "",
              latitude: "", longitude: "",
            }
      )
    }
  }, [open, venue, reset, isOwner, userId])

  async function handleFiles(files: FileList | File[]) {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`)
      return
    }
    const selected = Array.from(files).slice(0, remaining)
    const readers = selected.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
    )
    const dataUrls = await Promise.all(readers)
    setImages((prev) => [...prev, ...dataUrls])
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

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const ownerName = owners.find((o) => o.id === values.ownerId)?.name ?? ""
      const payload = {
        name:         values.name,
        owner:        { id: values.ownerId, name: ownerName },
        city:         values.city,
        address:      values.address,
        sports:       values.sports,
        pricePerHour: values.pricePerHour,
        description:  values.description,
        images,
        latitude:  values.latitude  ? parseFloat(values.latitude)  : undefined,
        longitude: values.longitude ? parseFloat(values.longitude) : undefined,
      }
      return isEdit ? updateVenue(venue!.id, payload) : createVenue(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? t("venue_updated") : t("venue_created"))
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      onOpenChange(false)
      onSuccess?.()
    },
    onError: () => toast.error(isEdit ? t("venue_update_failed") : t("venue_create_failed")),
  })

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  function toggleSport(sport: string, current: string[], onChange: (v: string[]) => void) {
    onChange(current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport])
  }

  const slotsLeft = MAX_IMAGES - images.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("edit_venue") : t("add_new_venue")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("venue_name")}</Label>
            <Input id="name" placeholder="Al-Ameen Football Arena" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Owner */}
          <div className="space-y-1.5">
            <Label>{t("owner")}</Label>
            <Controller
              name="ownerId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isOwner}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("select_owner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ownerId && <p className="text-xs text-destructive">{errors.ownerId.message}</p>}
          </div>

          {/* City + Address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">{t("city")}</Label>
              <Input id="city" placeholder="Amman" {...register("city")} />
              {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">{t("address")}</Label>
              <Input id="address" placeholder="Al-Rabweh St." {...register("address")} />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>
          </div>

          {/* Sports multi-select */}
          <div className="space-y-1.5">
            <Label>{t("sports")}</Label>
            <Controller
              name="sports"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal h-auto min-h-9 flex-wrap gap-1"
                    >
                      {field.value.length === 0 ? (
                        <span className="text-muted-foreground">{t("all_sports")}...</span>
                      ) : (
                        field.value.map((s) => (
                          <Badge key={s} variant="secondary" className="capitalize text-xs">{s}</Badge>
                        ))
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="grid grid-cols-2 gap-1">
                      {SPORTS.map((sport) => {
                        const selected = field.value.includes(sport.value)
                        return (
                          <button
                            key={sport.value}
                            type="button"
                            onClick={() => toggleSport(sport.value, field.value, field.onChange)}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                              selected ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                            )}
                          >
                            <Check className={cn("h-3 w-3 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                            {lang === "ar" ? sport.labelAr : sport.label}
                          </button>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.sports && <p className="text-xs text-destructive">{errors.sports.message}</p>}
          </div>

          {/* Price per hour */}
          <div className="space-y-1.5">
            <Label htmlFor="pricePerHour">{t("price_per_hour")}</Label>
            <Input
              id="pricePerHour"
              type="number"
              min={0}
              step={0.5}
              placeholder="25"
              {...register("pricePerHour", { valueAsNumber: true })}
            />
            {errors.pricePerHour && <p className="text-xs text-destructive">{errors.pricePerHour.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">
              {t("description")} <span className="text-muted-foreground">({t("optional")})</span>
            </Label>
            <textarea
              id="description"
              rows={3}
              placeholder="Brief description of the venue..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register("description")}
            />
          </div>

          {/* Images */}
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

          {/* Location */}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t("save_changes") : t("create_venue")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
