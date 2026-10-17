/** Small display helpers for the Today and new-booking pages, in the viewer's language. */

/** "18:30" → "6:30 PM" / "6:30 م". */
export function clockLabel(hhmm: string, lang: string): string {
  const [h, m] = hhmm.split(":").map(Number)
  const total = (((h || 0) * 60 + (m || 0)) % 1440 + 1440) % 1440
  const hh = Math.floor(total / 60)
  const mm = total % 60
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  const suffix = lang === "ar" ? (hh < 12 ? "ص" : "م") : hh < 12 ? "AM" : "PM"
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`
}

const SPORTS: Record<string, [string, string]> = {
  football: ["Football", "كرة القدم"],
  basketball: ["Basketball", "كرة السلة"],
  volleyball: ["Volleyball", "الكرة الطائرة"],
  tennis: ["Tennis", "التنس"],
  padel: ["Padel", "البادل"],
  squash: ["Squash", "الاسكواش"],
  swimming: ["Swimming", "السباحة"],
  cricket: ["Cricket", "الكريكت"],
}

export function sportName(sport: string, lang: string): string {
  const s = SPORTS[sport.toLowerCase()]
  return s ? s[lang === "ar" ? 1 : 0] : sport
}
