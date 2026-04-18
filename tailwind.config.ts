import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "Outfit", "sans-serif"],
        body:    ["Inter", "sans-serif"],
        mono:    ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
        arabic:  ["Cairo", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["clamp(2.5rem, 4vw, 3.25rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-md": ["clamp(2rem, 3vw, 2.5rem)",    { lineHeight: "1.1",  letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline":   ["1.5rem",                      { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" }],
        "label-md":   ["0.8125rem",                   { lineHeight: "1.4",  letterSpacing: "0.01em", fontWeight: "500" }],
        "label-sm":   ["0.75rem",                     { lineHeight: "1.35", letterSpacing: "0.02em", fontWeight: "500" }],
      },
      transitionTimingFunction: {
        kinetic: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      boxShadow: {
        ambient:       "0px 20px 40px rgba(19, 27, 46, 0.06)",
        "ambient-dark":"0px 20px 40px rgba(0, 0, 0, 0.3)",
        stadium:       "0 8px 24px -12px rgba(11,20,16,0.18)",
        "stadium-sm":  "0 1px 0 rgba(11,20,16,0.04), 0 1px 2px rgba(11,20,16,0.04)",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-container)) 100%)",
        "brand-gradient":   "linear-gradient(135deg, hsl(var(--brand)) 0%, hsl(var(--brand-2)) 100%)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          container: "hsl(var(--primary-container))",
          fixed: "hsl(var(--primary-fixed))",
          "on-fixed": "hsl(var(--on-primary-fixed))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT:    "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          2:          "hsl(var(--brand-2))",
          tint:       "hsl(var(--brand-tint))",
          ink:        "hsl(var(--brand-ink))",
        },
        /* Stadium Control Room extended palette */
        ink: {
          DEFAULT: "hsl(var(--ink))",
          2:       "hsl(var(--ink-2))",
          3:       "hsl(var(--ink-3))",
        },
        line: {
          DEFAULT: "hsl(var(--line))",
          strong:  "hsl(var(--line-strong))",
        },
        surface: {
          DEFAULT:   "hsl(var(--surface))",
          2:         "hsl(var(--surface-2))",
          3:         "hsl(var(--surface-3))",
          /* Back-compat aliases for old `bg-surface-raised` / `bg-surface-container-*` usages */
          low:       "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          high:      "hsl(var(--surface-container-high))",
          lowest:    "hsl(var(--surface-container-lowest))",
          raised:    "hsl(var(--surface-container-lowest))",
        },
        lime: {
          DEFAULT: "hsl(var(--lime))",
        },
        amber: {
          DEFAULT: "hsl(var(--amber))",
          tint:    "hsl(var(--amber-tint))",
          ink:     "hsl(var(--amber-ink))",
        },
        rose: {
          DEFAULT: "hsl(var(--rose))",
          tint:    "hsl(var(--rose-tint))",
          ink:     "hsl(var(--rose-ink))",
        },
        indigo: {
          DEFAULT: "hsl(var(--indigo))",
          tint:    "hsl(var(--indigo-tint))",
          ink:     "hsl(var(--indigo-ink))",
        },
        sky: {
          DEFAULT: "hsl(var(--sky))",
          tint:    "hsl(var(--sky-tint))",
          ink:     "hsl(var(--sky-ink))",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
          tint:    "hsl(var(--violet-tint))",
          ink:     "hsl(var(--violet-ink))",
        },
        slate: {
          ink: "hsl(var(--slate-ink))",
        },
        tertiary: "hsl(var(--tertiary))",
        "on-surface":         "hsl(var(--on-surface))",
        "on-surface-variant": "hsl(var(--on-surface-variant))",
        "outline-variant":    "hsl(var(--outline-variant))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}

export default config
