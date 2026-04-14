import api from "./axios"

export interface UserWithFcm {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: string
  avatar?: string
  hasFcm: boolean
  fcmPlatforms: string[]
}

export interface NotificationTemplate {
  id: string
  name: string
  title: string
  body: string
  type: string
  createdAt: string
}

export interface SendNotificationPayload {
  userIds: string[]
  title: string
  body: string
  type: string
  image?: string
}

export interface CreateTemplatePayload {
  name: string
  title: string
  body: string
  type: string
}

export interface UpdateTemplatePayload {
  name?: string
  title?: string
  body?: string
  type?: string
}

export async function getUsersWithFcm(params: { search?: string; role?: string; page?: number; limit?: number }) {
  const res = await api.get("/notifications/users", { params })
  return res.data
}

export async function sendNotification(payload: SendNotificationPayload) {
  const res = await api.post("/notifications/send", payload)
  return res.data
}

export async function getTemplates() {
  const res = await api.get("/notifications/templates")
  return res.data
}

export async function createTemplate(payload: CreateTemplatePayload) {
  const res = await api.post("/notifications/templates", payload)
  return res.data
}

export async function updateTemplate(id: string, payload: UpdateTemplatePayload) {
  const res = await api.patch(`/notifications/templates/${id}`, payload)
  return res.data
}

export async function deleteTemplate(id: string) {
  const res = await api.delete(`/notifications/templates/${id}`)
  return res.data
}
