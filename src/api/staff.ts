import api from "./axios"

export type StaffPermission = "read" | "write"

export interface StaffMember {
  id: string
  name: string
  email: string
  phone?: string | null
  role: string
  status: "active" | "banned"
  avatar?: string | null
  permissions?: StaffPermission | null
  managedByOwnerId?: string | null
  createdAt: string
}

interface Paginated<T> {
  data: T
  pagination?: { page: number; limit: number; total: number }
}

export interface CreateStaffPayload {
  name: string
  email: string
  password: string
  phone?: string
  permissions: StaffPermission
}

/**
 * An owner's own team. Deliberately NOT `GET /users` — that is the platform-wide
 * directory and is admin-only. The API derives the owner from the token, so no
 * owner_id is sent here.
 */
export async function getStaff(params?: { page?: number; limit?: number }): Promise<Paginated<StaffMember[]>> {
  const res = await api.get<Paginated<StaffMember[]>>("/users/staff", { params })
  return res.data
}

export async function createStaff(payload: CreateStaffPayload): Promise<{ data: StaffMember }> {
  const res = await api.post<{ data: StaffMember }>("/users", {
    ...payload,
    role: "venue_staff",
  })
  return res.data
}

export async function updateStaffPermissions(
  userId: string,
  permissions: StaffPermission,
): Promise<{ data: StaffMember }> {
  const res = await api.patch<{ data: StaffMember }>(`/users/${userId}/permissions`, { permissions })
  return res.data
}

export async function updateStaffStatus(
  userId: string,
  status: "active" | "banned",
): Promise<{ data: StaffMember }> {
  const res = await api.patch<{ data: StaffMember }>(`/users/${userId}/status`, { status })
  return res.data
}
