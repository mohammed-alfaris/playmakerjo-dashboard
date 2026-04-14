import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Camera, Loader2, KeyRound, User } from "lucide-react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/useAuth"
import { updateMyProfile, changeMyPassword } from "@/api/users"
import { useT } from "@/i18n/LanguageContext"

// ─── Profile info schema ──────────────────────────────────────────────────────
const profileSchema = z.object({
  name:  z.string().min(2, "Name is required"),
  phone: z.string().optional(),
})
type ProfileValues = z.infer<typeof profileSchema>

// ─── Password schema ──────────────────────────────────────────────────────────
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword:     z.string().min(8, "password_min"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "passwords_no_match",
  path:    ["confirmPassword"],
})
type PasswordValues = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { t } = useT()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatar)

  // ─── Profile form ─────────────────────────────────────────────────────────
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "", phone: user?.phone ?? "" },
  })

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues & { avatar?: string }) =>
      updateMyProfile(values),
    onSuccess: (res) => {
      toast.success(t("profile_updated"))
      updateUser({ name: res.data.name, phone: res.data.phone, avatar: res.data.avatar })
    },
    onError: () => toast.error(t("profile_update_failed")),
  })

  // ─── Avatar upload ────────────────────────────────────────────────────────
  const avatarMutation = useMutation({
    mutationFn: (avatar: string) => updateMyProfile({ avatar }),
    onSuccess: (res) => {
      toast.success(t("avatar_updated"))
      updateUser({ avatar: res.data.avatar })
    },
    onError: () => toast.error(t("avatar_update_failed")),
  })

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    try {
      // Show preview immediately
      const previewUrl = URL.createObjectURL(file)
      setAvatarPreview(previewUrl)
      // Upload file to server
      const { uploadFile } = await import("@/api/uploads")
      const url = await uploadFile(file, "avatar")
      setAvatarPreview(url)
      avatarMutation.mutate(url)
    } catch (err) {
      console.error("Avatar upload failed:", err)
      toast.error(t("avatar_update_failed"))
      setAvatarPreview(null)
    }
  }

  function onProfileSubmit(values: ProfileValues) {
    profileMutation.mutate(values)
  }

  // ─── Password form ────────────────────────────────────────────────────────
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  })

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      changeMyPassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success(t("password_changed"))
      passwordForm.reset()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? ""
      if (msg.toLowerCase().includes("incorrect")) {
        passwordForm.setError("currentPassword", { message: t("wrong_current_password") })
      } else {
        toast.error(t("password_change_failed"))
      }
    },
  })

  function onPasswordSubmit(values: PasswordValues) {
    passwordMutation.mutate(values)
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title={t("profile_settings")} subtitle={t("profile_subtitle")} />

      {/* ── Account info ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-brand" />
          {t("account_info")}
        </div>
        <Separator />

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div
            className="relative cursor-pointer group"
            onClick={() => avatarInputRef.current?.click()}
          >
            <Avatar className="h-16 w-16">
              {avatarPreview && <AvatarImage src={avatarPreview} alt={user?.name} />}
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarMutation.isPending
                ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                : <Camera className="h-5 w-5 text-white" />}
            </div>
          </div>
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{user?.role?.replace("_", " ")}</p>
          </div>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

        {/* Profile form */}
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("name")}</Label>
              <Input {...profileForm.register("name")} />
              {profileForm.formState.errors.name && (
                <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("phone")} <span className="text-muted-foreground text-xs">({t("optional")})</span></Label>
              <Input {...profileForm.register("phone")} placeholder="+962791000000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("email")}</Label>
            <Input value={user?.email ?? ""} disabled className="opacity-60" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={profileMutation.isPending}>
              {profileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save_changes")}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Change password ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-brand" />
          {t("change_password")}
        </div>
        <Separator />

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("current_password")}</Label>
            <Input type="password" {...passwordForm.register("currentPassword")} />
            {passwordForm.formState.errors.currentPassword && (
              <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("new_password")}</Label>
              <Input type="password" {...passwordForm.register("newPassword")} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{t("password_min")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("confirm_password")}</Label>
              <Input type="password" {...passwordForm.register("confirmPassword")} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{t("passwords_no_match")}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("change_password")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
