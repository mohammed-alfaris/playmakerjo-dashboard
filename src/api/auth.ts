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
