/**
 * JS-accessible palette for consumers that can't use CSS variables at render time
 * (Recharts, canvas-drawn components, chart legend configs).
 *
 * Keep these in sync with index.css :root variables.
 * Do NOT use these in React component className props — use Tailwind tokens there
 * (bg-primary, text-on-surface, etc.).
 */

export const LIGHT_TOKENS = {
  primary: "#0b6438",
  primaryContainer: "#2e7d4f",
  primaryFixed: "#cfe8d8",
  tertiary: "#8c3d4a",
  onSurface: "#131b2e",
  onSurfaceVariant: "#475064",
  outlineVariant: "#d0d4dc",
  surface: "#faf8ff",
  surfaceContainerLow: "#f2eefa",
  surfaceContainer: "#ece7f5",
  surfaceContainerHigh: "#e6e0f0",
  surfaceContainerLowest: "#ffffff",
} as const

export const DARK_TOKENS = {
  primary: "#3aa96a",
  primaryContainer: "#5cc088",
  primaryFixed: "#2a4f3a",
  tertiary: "#c26a7a",
  onSurface: "#fafafa",
  onSurfaceVariant: "#a7acb9",
  outlineVariant: "#3a4157",
  surface: "#0e1525",
  surfaceContainerLow: "#131b2e",
  surfaceContainer: "#1a2238",
  surfaceContainerHigh: "#212a42",
  surfaceContainerLowest: "#1a2238",
} as const

/**
 * Recharts-friendly chart palette. First 8 colors cover all existing
 * sports breakdown chart slots. Append more as new categories are added.
 */
export const CHART_COLORS = [
  "#0b6438", // primary
  "#2e7d4f", // primary-container
  "#8c3d4a", // tertiary
  "#3b82a0", // info blue
  "#c07b2a", // amber
  "#6b4f8a", // purple
  "#2e7d7d", // teal
  "#a34545", // coral
] as const

/**
 * Utility for gauge/progress components that need a CSS linear-gradient string
 * referencing the primary gradient (cannot use Tailwind class in inline style).
 */
export const PRIMARY_GRADIENT_CSS =
  "linear-gradient(135deg, #0b6438 0%, #2e7d4f 100%)"

export type DesignTokens = Record<keyof typeof LIGHT_TOKENS, string>

/**
 * Reads the document class to pick the appropriate token set at runtime.
 * Use only for Recharts or other JS-time consumers.
 */
export function getActiveTokens(): DesignTokens {
  if (typeof document === "undefined") return LIGHT_TOKENS
  return document.documentElement.classList.contains("dark")
    ? DARK_TOKENS
    : LIGHT_TOKENS
}
