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
        display: ["Outfit", "sans-serif"],
        body:    ["Inter", "sans-serif"],
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
        ambient: "0px 20px 40px rgba(19, 27, 46, 0.06)",
        "ambient-dark": "0px 20px 40px rgba(0, 0, 0, 0.3)",
      },
      backgroundImage: {
        "primary-gradient": "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-container)) 100%)",
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
        },
        /* Emerald Pitch layering — use these to separate sections WITHOUT borders */
        surface: {
          DEFAULT:   "hsl(var(--surface))",
          low:       "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          high:      "hsl(var(--surface-container-high))",
          lowest:    "hsl(var(--surface-container-lowest))",
          /* Back-compat alias — old `bg-surface-raised` keeps working */
          raised:    "hsl(var(--surface-container-lowest))",
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
