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
  /** The company role they hold. */
  staffRole?: { id: string; name: string } | null
  /** True = every venue of the company; otherwise only `venueIds`. */
  allVenues?: boolean
  venueIds?: string[]
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
  staffRoleId: string
  allVenues: boolean
  venueIds: string[]
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

export interface StaffAssignment {
  staffRoleId?: string
  allVenues?: boolean
  venueIds?: string[]
}

/** Change a clerk's role and/or the venues they work at. Takes effect on their next request. */
export async function updateStaffAssignment(
  userId: string,
  assignment: StaffAssignment,
): Promise<{ data: StaffMember }> {
  const res = await api.patch<{ data: StaffMember }>(`/users/${userId}/staff`, assignment)
  return res.data
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export interface StaffRole {
  id: string
  name: string
  permissions: string[]
  /** How many of the company's staff hold it. A role in use cannot be deleted. */
  staffCount: number
}

export interface StaffRolePayload {
  name: string
  permissions: string[]
}

/**
 * The owner's roles. Two starters ("Front desk", "View only") always exist. An admin passes
 * the company's owner id; for owners the server uses their own company whatever is sent.
 */
export async function getStaffRoles(ownerId?: string): Promise<{ data: StaffRole[] }> {
  const res = await api.get<{ data: StaffRole[] }>("/staff-roles", { params: ownerId ? { owner_id: ownerId } : undefined })
  return res.data
}

export async function createStaffRole(payload: StaffRolePayload): Promise<{ data: StaffRole }> {
  const res = await api.post<{ data: StaffRole }>("/staff-roles", payload)
  return res.data
}

export async function updateStaffRole(id: string, payload: Partial<StaffRolePayload>): Promise<{ data: StaffRole }> {
  const res = await api.patch<{ data: StaffRole }>(`/staff-roles/${id}`, payload)
  return res.data
}

/** 409 while anyone holds the role — the server's message says how many. */
export async function deleteStaffRole(id: string): Promise<void> {
  await api.delete(`/staff-roles/${id}`)
}

export async function updateStaffStatus(
  userId: string,
  status: "active" | "banned",
): Promise<{ data: StaffMember }> {
  const res = await api.patch<{ data: StaffMember }>(`/users/${userId}/status`, { status })
  return res.data
}
