import { useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, UserPlus, AlertTriangle, UserCheck } from "lucide-react"
import { lookupCustomer, normalizeJordanPhone, type Customer } from "@/api/customers"
import { useT } from "@/i18n/LanguageContext"

export interface CustomerDraft {
  phone: string
  name: string
}

interface Props {
  value: CustomerDraft
  onChange: (next: CustomerDraft) => void
  /** The resolved customer, so the caller can show history or send the id onward. */
  onResolved?: (customer: Customer | null) => void
  autoFocus?: boolean
  disabled?: boolean
}

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-[hsl(var(--line))] bg-card px-2 text-sm " +
  "text-[hsl(var(--ink))] placeholder:text-[hsl(var(--ink-3))] " +
  "focus:border-[hsl(var(--brand))] focus:outline-none"

/**
 * Phone first, name second — the capture mechanic the whole customer book rests on.
 *
 * The owner fills the phone in not because we asked, but because filling it tells him
 * something he did not know BEFORE he gives the slot away: that this person has missed
 * three times, or that they are a regular he should look after. That reward is the only
 * reason an optional field ever becomes a habit.
 *
 * There is no debounce hook here on purpose. A Jordanian mobile is exactly nine significant
 * digits, so `normalizeJordanPhone` returns null until the number is complete and non-null
 * on exactly one keystroke — validity IS the debounce, and it never fires on a half-typed
 * number.
 */
export function CustomerPhoneField({ value, onChange, onResolved, autoFocus, disabled }: Props) {
  const { t } = useT()
  // Once the owner edits the name themselves we stop overwriting it from lookups.
  const nameTouched = useRef(false)

  const normalized = normalizeJordanPhone(value.phone)

  const lookup = useQuery({
    queryKey: ["customer-lookup", normalized],
    queryFn: async () => {
      const found = await lookupCustomer(normalized!)
      if (found && !nameTouched.current) onChange({ phone: value.phone, name: found.name })
      onResolved?.(found)
      return found
    },
    enabled: !!normalized,
    staleTime: 60_000,
    // A failed lookup must NEVER block a booking — the person is at the counter.
    retry: 0,
  })

  const customer = lookup.data ?? null
  const stats = customer?.stats

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[hsl(var(--ink-3))]">
            {t("customer_phone")}
          </span>
          <input
            type="tel"
            inputMode="tel"
            // Unconditional LTR so a +962 number is never mirrored in the Arabic UI.
            dir="ltr"
            autoFocus={autoFocus}
            disabled={disabled}
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            placeholder="07 9123 4567"
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[hsl(var(--ink-3))]">
            {t("customer_name")}
          </span>
          <input
            type="text"
            disabled={disabled}
            value={value.name}
            onChange={(e) => {
              nameTouched.current = true
              onChange({ ...value, name: e.target.value })
            }}
            placeholder={t("customer_name_placeholder")}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {/* Reserve the height so the dialog does not jump as states change. */}
      <div className="flex min-h-[26px] flex-wrap items-center gap-1.5 text-[11px]">
        {lookup.isFetching && (
          <span className="inline-flex items-center gap-1.5 text-[hsl(var(--ink-3))]">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("customer_checking")}
          </span>
        )}

        {!lookup.isFetching && customer && stats && (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 font-medium text-brand-ink">
              <UserCheck className="h-3 w-3" />
              {t("customer_known")}
            </span>
            <span className="text-[hsl(var(--ink-3))]">
              {t("customer_visits").replace("{n}", String(stats.attended))}
            </span>
            {stats.daysSinceLastVisit != null && (
              <span className="text-[hsl(var(--ink-3))]">
                · {t("customer_last_seen").replace("{n}", String(stats.daysSinceLastVisit))}
              </span>
            )}
            {stats.noShow > 0 && (
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold " +
                  (stats.isUnreliable
                    ? "bg-rose-tint text-rose-ink"
                    : "bg-amber-tint text-amber-ink")
                }
              >
                <AlertTriangle className="h-3 w-3" />
                {t("customer_no_shows").replace("{n}", String(stats.noShow))}
              </span>
            )}
            {stats.amountOwed > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-tint px-2 py-0.5 font-semibold text-amber-ink">
                {t("customer_owes").replace("{amount}", stats.amountOwed.toFixed(2))}
              </span>
            )}
            {customer.note && (
              <span className="text-[hsl(var(--ink-3))]">· {customer.note}</span>
            )}
          </>
        )}

        {!lookup.isFetching && normalized && !customer && !lookup.isError && (
          <span className="inline-flex items-center gap-1 text-[hsl(var(--ink-3))]">
            <UserPlus className="h-3 w-3" />
            {t("customer_new")}
          </span>
        )}

        {lookup.isError && (
          <span className="text-[hsl(var(--ink-3))]">{t("customer_lookup_failed")}</span>
        )}

        {/* A number that will never become a customer.
            The server keeps the booking and silently drops the customer when the phone is
            not a Jordanian mobile — a landline, a Gulf number, or one digit short. That is
            the right call for the booking (never block a sale over a phone number) but it
            was invisible: the clerk typed a number, saw nothing, and the name was gone.
            Say so while they can still fix it. Deliberately not an error state — the
            booking is fine, it is only the customer record that will not exist. */}
        {!lookup.isFetching && !normalized && value.phone.replace(/\D/g, "").length >= 7 && (
          <span className="inline-flex items-center gap-1 text-amber-ink">
            <AlertTriangle className="h-3 w-3" />
            {t("customer_phone_not_saved")}
          </span>
        )}
      </div>
    </div>
  )
}

export default CustomerPhoneField
