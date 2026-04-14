// ─── Country / Currency expansion foundation ─────────────────────────────────
// Add more countries here as the platform expands to new markets
export const COUNTRIES = [
  { code: "JO", name: "Jordan",       currency: "JOD", phonePrefix: "+962", locale: "ar-JO" },
  // { code: "SA", name: "Saudi Arabia", currency: "SAR", phonePrefix: "+966", locale: "ar-SA" },
  // { code: "AE", name: "UAE",          currency: "AED", phonePrefix: "+971", locale: "ar-AE" },
  // { code: "KW", name: "Kuwait",       currency: "KWD", phonePrefix: "+965", locale: "ar-KW" },
  // { code: "QA", name: "Qatar",        currency: "QAR", phonePrefix: "+974", locale: "ar-QA" },
] as const

export const DEFAULT_COUNTRY  = COUNTRIES[0]             // Jordan 🇯🇴
export const DEFAULT_CURRENCY = DEFAULT_COUNTRY.currency  // "JOD"
export const DEFAULT_LOCALE   = DEFAULT_COUNTRY.locale    // "ar-JO"
export const DEFAULT_PHONE_PREFIX = DEFAULT_COUNTRY.phonePrefix // "+962"

// ─── Sports ──────────────────────────────────────────────────────────────────
export const SPORTS = [
  { value: "football",   label: "Football",   labelAr: "كرة القدم" },
  { value: "basketball", label: "Basketball", labelAr: "كرة السلة" },
  { value: "tennis",     label: "Tennis",     labelAr: "التنس" },
  { value: "padel",      label: "Padel",      labelAr: "البادل" },
  { value: "volleyball", label: "Volleyball", labelAr: "الكرة الطائرة" },
  { value: "squash",     label: "Squash",     labelAr: "الإسكواش" },
  { value: "cricket",    label: "Cricket",    labelAr: "الكريكيت" },
  { value: "swimming",   label: "Swimming",   labelAr: "السباحة" },
] as const

// ─── Statuses ─────────────────────────────────────────────────────────────────
export const VENUE_STATUSES = [
  { value: "active",   label: "Active",   labelAr: "نشط" },
  { value: "inactive", label: "Inactive", labelAr: "غير نشط" },
  { value: "pending",  label: "Pending",  labelAr: "قيد الانتظار" },
] as const

export const BOOKING_STATUSES = [
  { value: "pending",   label: "Pending",   labelAr: "قيد الانتظار" },
  { value: "confirmed", label: "Confirmed", labelAr: "مؤكد" },
  { value: "cancelled", label: "Cancelled", labelAr: "ملغى" },
  { value: "completed", label: "Completed", labelAr: "مكتمل" },
  { value: "no_show",   label: "No Show",   labelAr: "لم يحضر" },
] as const

export const PAYMENT_STATUSES = [
  { value: "paid",     label: "Paid",     labelAr: "مدفوع" },
  { value: "pending",  label: "Pending",  labelAr: "قيد الانتظار" },
  { value: "failed",   label: "Failed",   labelAr: "فشل" },
  { value: "refunded", label: "Refunded", labelAr: "مسترد" },
] as const

export const USER_STATUSES = [
  { value: "active", label: "Active", labelAr: "نشط" },
  { value: "banned", label: "Banned", labelAr: "محظور" },
] as const

// ─── Roles ───────────────────────────────────────────────────────────────────
export const USER_ROLES = [
  { value: "super_admin",  label: "Super Admin",  labelAr: "سوبر أدمن" },
  { value: "venue_owner",  label: "Venue Owner",  labelAr: "صاحب ملعب" },
  { value: "venue_staff",  label: "Venue Staff",  labelAr: "مشرف ملعب" },
  { value: "player",       label: "Player",       labelAr: "لاعب" },
] as const

// ─── Staff Permissions ────────────────────────────────────────────────────────
export const USER_PERMISSIONS = [
  { value: "read",  label: "Read only",      labelAr: "قراءة فقط" },
  { value: "write", label: "Read & Write",   labelAr: "قراءة وكتابة" },
] as const

// ─── Platform fees ────────────────────────────────────────────────────────────
export const PLATFORM_FEE_PERCENTAGE = 5

// ─── Pagination ───────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20
