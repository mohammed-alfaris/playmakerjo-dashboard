import api from "./axios"
import type { Usage } from "@/lib/permissions"

/** A venue owner's account, seen as a company: who owns it, what it uses, what it may. */
export interface Company {
  /** The owner's user id — companies are keyed by their owner. */
  id: string
  name: string
  nameAr?: string | null
  ownerName: string
  ownerEmail: string
  ownerStatus: "active" | "banned"
  venues: Usage
  staff: Usage
  createdAt: string
}

export interface CompanyLimits {
  /** null = unlimited. */
  maxVenues: number | null
  maxStaff: number | null
}

interface Paginated<T> {
  data: T
  pagination?: { page: number; limit: number; total: number }
}

/** The signed-in owner's own company, with usage — what gates the Add buttons. */
export async function getMyCompany(): Promise<{ data: Company }> {
  const res = await api.get<{ data: Company }>("/companies/me")
  return res.data
}

/** Names only. Limits are PlayMaker's to set; sending them here is refused. */
export async function updateMyCompany(body: { name?: string; nameAr?: string }): Promise<{ data: Company }> {
  const res = await api.patch<{ data: Company }>("/companies/me", body)
  return res.data
}

/** Admin: every company. */
export async function getCompanies(params: { page?: number; limit?: number; search?: string }): Promise<Paginated<Company[]>> {
  const res = await api.get<Paginated<Company[]>>("/companies", { params })
  return res.data
}

/**
 * Admin: rename a company or set its limits. `limits` sets both at once; lowering one below
 * what the company already has switches nothing off, it only stops new additions.
 */
export async function updateCompany(
  ownerId: string,
  body: { name?: string; nameAr?: string; limits?: CompanyLimits },
): Promise<{ data: Company }> {
  const res = await api.patch<{ data: Company }>(`/companies/${ownerId}`, body)
  return res.data
}

/** Admin: one company. */
export async function getCompany(ownerId: string): Promise<{ data: Company }> {
  const res = await api.get<{ data: Company }>(`/companies/${ownerId}`)
  return res.data
}
