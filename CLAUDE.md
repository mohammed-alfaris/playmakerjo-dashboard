# YallaNhjez — Admin Dashboard

## Project overview
React admin dashboard for the YallaNhjez sports venue booking platform.
Used by **super_admin** (full access) and **venue_owner** (scoped to own venues).
Connects to the ASP.NET Core 9 backend API.
Bilingual: English + Arabic (RTL).

---

## Tech stack
| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 8 |
| Styling | TailwindCSS 3 |
| Routing | React Router 7 (lazy-loaded pages) |
| Server state | TanStack Query 5 |
| Tables | TanStack Table 8 |
| Client state | Zustand 5 (auth store) |
| Forms | React Hook Form 7 + Zod 4 |
| Charts | Recharts 3 |
| UI primitives | Radix UI (shadcn/ui) |
| Toasts | Sonner |
| Icons | Lucide React |
| HTTP | Axios (with auth interceptor) |
| Mocking | MSW 2 (mock service worker) |
| i18n | Custom translations (EN/AR) with `useT()` hook |

---

## Commands
```bash
npm run dev         # Dev server (http://localhost:5173)
npm run build       # tsc -b && vite build
npm run typecheck   # tsc -b --noEmit
npm run lint        # ESLint
```

---

## Project structure
```
yalla-nhjez-dashboard/
├── src/
│   ├── api/                    # Axios-based API layer
│   │   ├── axios.ts            # Axios instance + auth interceptor
│   │   ├── auth.ts
│   │   ├── bookings.ts
│   │   ├── notifications.ts
│   │   ├── payments.ts
│   │   ├── reports.ts
│   │   ├── uploads.ts
│   │   ├── users.ts
│   │   └── venues.ts
│   ├── components/
│   │   ├── shared/             # AppLayout, StatusBadge, DataTable, PageHeader, etc.
│   │   └── ui/                 # shadcn/ui primitives (Button, Dialog, Input, etc.)
│   ├── features/               # Feature modules (one folder per page)
│   │   ├── auth/               # LoginPage
│   │   ├── dashboard/          # DashboardPage (KPIs, charts)
│   │   ├── bookings/           # BookingsPage, ProofReviewDialog
│   │   ├── venues/             # VenuesPage, VenueDetailPage, VenueFormDialog
│   │   ├── users/              # UsersPage
│   │   ├── payments/           # PaymentsPage
│   │   ├── reports/            # ReportsPage (charts, CSV/PDF export)
│   │   ├── notifications/      # NotificationsPage (send, templates, user table)
│   │   └── profile/            # ProfilePage
│   ├── hooks/                  # Custom hooks (useDebounce, etc.)
│   ├── i18n/
│   │   ├── translations.ts     # EN + AR translation objects
│   │   └── LanguageContext.tsx  # useT() hook, TranslationKey type
│   ├── lib/
│   │   ├── constants.ts        # Status arrays, sport types
│   │   └── utils.ts            # cn() helper
│   ├── mocks/                  # MSW handlers for dev without backend
│   ├── store/
│   │   └── authStore.ts        # Zustand auth state
│   └── router.tsx              # React Router config
├── public/
├── package.json
└── CLAUDE.md
```

---

## Routes
| Path | Component | Access |
|------|-----------|--------|
| `/login` | LoginPage | Public |
| `/` | DashboardPage | All authenticated |
| `/venues` | VenuesPage | All authenticated |
| `/venues/:id` | VenueDetailPage | All authenticated |
| `/bookings` | BookingsPage | All authenticated |
| `/reports` | ReportsPage | All authenticated |
| `/profile` | ProfilePage | All authenticated |
| `/users` | UsersPage | super_admin only |
| `/payments` | PaymentsPage | super_admin only |
| `/notifications` | NotificationsPage | super_admin only |

---

## Roles & permissions
- **super_admin**: Full access to all pages and actions
- **venue_owner**: Dashboard, Venues (own only), Bookings (own venues), Reports (own stats), Profile

---

## Key features

### Venue management
- CRUD venues with image upload (max 5), drag reorder
- CliQ alias + deposit percentage configuration
- Operating hours, min/max booking duration
- Sport types, city, coordinates, pricing

### Booking management
- List all bookings with filters (status, venue, date range)
- Proof review dialog (approve/reject CliQ payment screenshots)
- Mark bookings: confirmed, completed, no-show, cancelled

### Notification management (super_admin)
- User table with search, role filter, FCM status indicators
- Select users via checkboxes to send notifications
- Notification form: type, title, body, optional image
- Saved notification templates (CRUD)

### Reports
- Revenue chart, top venues, sports breakdown
- CSV/PDF export with date range + venue filter

### StatusBadge
Shared component supporting 15 statuses: active, inactive, pending, confirmed, cancelled, completed, banned, paid, failed, refunded, pending_review, pending_payment, approved, rejected, no_show.

---

## i18n
- Two languages: English (`en`) and Arabic (`ar`)
- Translations in `src/i18n/translations.ts` — both objects must have identical keys
- Type-safe via `TranslationKey` type
- `useT()` hook returns `{ t, lang, setLang, dir }`
- RTL layout automatic when Arabic selected

---

## API connection
```env
VITE_MOCK_API=false
VITE_API_URL=http://localhost:8000/api/v1
```

Auth: JWT Bearer token stored in Zustand, interceptor auto-attaches to requests and handles refresh.

---

## Code conventions
- Feature-based folder structure (one folder per page/feature)
- Path alias: `@/` maps to `src/`
- `useT()` for all user-facing strings — no hardcoded text
- `ApiResponse<T>` envelope expected from all API responses
- React Query for server state, Zustand only for auth
- shadcn/ui primitives in `components/ui/`, composed in `components/shared/`
- Zod schemas for form validation
