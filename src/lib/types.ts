export type DayOfWeek =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday"

export interface DayHours {
  /** "HH:mm" 24-hour, e.g. "08:00". Empty string = closed. */
  open: string
  /** "HH:mm" 24-hour. May be earlier than `open` for overnight venues. */
  close: string
  /** When true, the venue is closed that day regardless of open/close. */
  closed?: boolean
}

export type OperatingHours = Partial<Record<DayOfWeek, DayHours>>
