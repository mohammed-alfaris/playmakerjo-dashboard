import api from "./axios"

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  avatar?: string
  /** "read" | "write" — only present for venue_staff. */
  permissions?: "read" | "write" | null
  /** The venue_owner a staff account works for. Null for every other role. */
  managedByOwnerId?: string | null
  /**
   * What this user may do, from GET /users/me. Absent right after login and in a session
   * restored from storage until /users/me answers; useRole falls back to `permissions` then.
   */
  access?: AccessSummary
}

export interface AccessSummary {
  /** The owner's user id — the company. Null for admins and players. */
  companyId: string | null
  companyName: string | null
  staffRole?: { id: string; name: string } | null
  permissions: string[]
  /** True for owners, admins, and staff not limited to particular venues. */
  allVenues: boolean
  venueIds: string[]
  /** PlayMaker has suspended the company: no back office until it is lifted. */
  companySuspended?: boolean
}

export interface LoginResponse {
  success: boolean
  data: {
    user: AuthUser
    accessToken: string
  }
  message: string
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/auth/login", payload)
  return res.data
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout")
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  const res = await api.post<{ data: { accessToken: string } }>("/auth/refresh")
  return res.data.data
}
