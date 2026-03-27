import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      screens: {
        ultra: "1600px"
      },
      maxWidth: {
        shell: "1600px"
      },
      colors: {
        brand: {
          warm: {
            500: "var(--color-brand-warm-500)"
          },
          calm: {
            600: "var(--color-brand-calm-600)"
          },
          support: {
            500: "var(--color-brand-support-500)"
          }
        },
        neutral: {
          0: "var(--color-neutral-0)",
          100: "var(--color-neutral-100)",
          300: "var(--color-neutral-300)",
          600: "var(--color-neutral-600)",
          800: "var(--color-neutral-800)",
          950: "var(--color-neutral-950)"
        },
        surface: {
          warm: "var(--color-surface-warm)",
          cool: "var(--color-surface-cool)"
        },
        semantic: {
          success: "var(--color-semantic-success)",
          warning: "var(--color-semantic-warning)",
          error: "var(--color-semantic-error)",
          info: "var(--color-semantic-info)"
        }
      },
      spacing: {
        100: "var(--space-100)",
        200: "var(--space-200)",
        300: "var(--space-300)",
        400: "var(--space-400)",
        500: "var(--space-500)",
        700: "var(--space-700)",
        900: "var(--space-900)"
      },
      borderRadius: {
        200: "var(--radius-200)",
        300: "var(--radius-300)",
        pill: "var(--radius-pill)"
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      fontSize: {
        display: ["4rem", { lineHeight: "0.95", fontWeight: "700", letterSpacing: "-0.04em" }],
        h1: ["3rem", { lineHeight: "1", fontWeight: "600", letterSpacing: "-0.03em" }],
        h2: ["2rem", { lineHeight: "1.1", fontWeight: "600", letterSpacing: "-0.02em" }],
        h3: ["1.5rem", { lineHeight: "1.2", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        label: ["0.75rem", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "0.12em" }],
        mono: ["0.75rem", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "0.08em" }]
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
        macro: "800ms"
      },
      transitionTimingFunction: {
        standard: "var(--motion-ease-standard)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        panel: "var(--shadow-panel)"
      }
    }
  },
  plugins: []
};

export default config;
