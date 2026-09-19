import axios from "axios"
import { useAuthStore } from "@/store/authStore"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 15000,
})

/**
 * A bare instance used ONLY for POST /auth/refresh.
 *
 * The refresh call must never travel through `api`, because `api` carries the
 * 401 interceptor below. When the refresh token itself is expired the server
 * answers 401, the interceptor re-enters, sees `isRefreshing === true`, and
 * parks the request on `failedQueue` — a queue that can only be drained by the
 * very `await` that is now blocked on it. The result is a permanent deadlock:
 * `isRefreshing` stays true forever, logout never runs, and every later 401
 * queues silently. The user sees an app that simply stops responding.
 *
 * It also carries no request interceptor, so it never attaches a stale access
 * token — the refresh token lives in an httpOnly cookie sent by withCredentials.
 */
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 15000,
})

// --- Request interceptor: attach Bearer token ---
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// --- Response interceptor: handle 401 → refresh → retry ---
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(token!)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      })
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        })
        .catch((err) => Promise.reject(err))
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await refreshClient.post<{ data: { accessToken: string } }>(
        "/auth/refresh"
      )
      const newToken = res.data.data.accessToken
      useAuthStore.getState().setToken(newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      processQueue(null, newToken)
      return api(original)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().logout()
      window.location.href = "/login"
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
