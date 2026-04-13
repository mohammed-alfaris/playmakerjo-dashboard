import api from "./axios"

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: "active" | "banned"
  avatar?: string
  permissions?: "read" | "write"
  createdAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  phone?: string
  role: string
  permissions?: "read" | "write"
}

export interface UsersParams {
  page?: number
  limit?: number
  role?: string
  status?: string
  search?: string
}

export async function getUsers(params: UsersParams) {
  const res = await api.get("/users", { params })
  return res.data
}

export async function updateUserStatus(id: string, status: "active" | "banned") {
  const res = await api.patch(`/users/${id}/status`, { status })
  return res.data
}

export async function updateUserRole(id: string, role: string) {
  const res = await api.patch(`/users/${id}/role`, { role })
  return res.data
}

export async function updateUserAvatar(id: string, avatar: string) {
  const res = await api.patch(`/users/${id}/avatar`, { avatar })
  return res.data
}

export async function createUser(payload: CreateUserPayload) {
  const res = await api.post("/users", payload)
  return res.data
}

export async function updateMyProfile(data: { name?: string; phone?: string; avatar?: string }) {
  const res = await api.patch("/users/me", data)
  return res.data
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const res = await api.patch("/users/me/password", { currentPassword, newPassword })
  return res.data
}

export async function getMe() {
  const res = await api.get("/users/me")
  return res.data
}
