import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "./index.css"
import { router } from "./router"
import { LanguageProvider } from "./i18n/LanguageContext"
import { ErrorBoundary } from "./components/shared/ErrorBoundary"

// Recover from "Failed to fetch dynamically imported module" after a deploy.
//
// Vite fingerprints each lazy route chunk (e.g. /assets/TimelinePage-<hash>.js).
// When a new build is deployed, old hashed filenames disappear; tabs that still
// hold stale index.html will 404 the old chunk on the next route transition.
//
// - `vite:preloadError` is emitted by Vite's module preloader when a chunk
//   fails to load (covers both `<link rel="modulepreload">` failures and
//   dynamic `import()` rejections from lazy routes).
// - The global `error` event catches the "Failed to fetch dynamically imported
//   module" TypeError that React Router re-throws on transition.
//
// We reload at most once per tab (tracked via sessionStorage) to avoid a loop
// if the chunk is genuinely missing on the server, not just stale in-browser.
const RELOAD_FLAG = "pmjo:chunkReloadedAt"

function reloadOnce(reason: string) {
  const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? "0")
  const now = Date.now()
  // Give up if we've already reloaded in the last 30 seconds.
  if (now - last < 30_000) {
    console.error(`[preload-recovery] Already reloaded recently, not retrying. Reason: ${reason}`)
    return
  }
  sessionStorage.setItem(RELOAD_FLAG, String(now))
  console.warn(`[preload-recovery] Reloading to pick up new build. Reason: ${reason}`)
  window.location.reload()
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault()
  reloadOnce("vite:preloadError")
})

window.addEventListener("error", (event) => {
  const msg = event?.message ?? ""
  if (typeof msg === "string" && /Failed to fetch dynamically imported module/i.test(msg)) {
    reloadOnce("dynamic-import-failed")
  }
})

window.addEventListener("unhandledrejection", (event) => {
  const reason = (event?.reason?.message ?? String(event?.reason ?? "")) as string
  if (typeof reason === "string" && /Failed to fetch dynamically imported module/i.test(reason)) {
    reloadOnce("unhandled-dynamic-import-rejection")
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

async function prepare() {
  if (import.meta.env.VITE_MOCK_API === "true") {
    const { worker } = await import("./mocks/browser")
    await worker.start({ onUnhandledRequest: "bypass" })
  }
}

prepare().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </StrictMode>
  )
})
