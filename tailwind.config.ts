import type { Config } from "tailwindcss";

// Design tokens — light-first system. Token NAMES are unchanged from the
// original dark palette (canvas/ink/accent/state) so every existing
// component's className strings keep working — only the underlying VALUES
// changed. This is what makes a system-wide theme swap possible without
// touching dozens of component files individually. See README.md#visual-identity.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#F7F8FC",  // page background — soft neutral, not pure white
          surface: "#FFFFFF",   // panel / card surface (layer 1)
          raised: "#FBFBFD",    // sidebar / raised surface (layer 2)
          grid: "#F4F6FA",      // canvas/graph background specifically
          border: "#E4E7EF",    // soft neutral gray border
        },
        ink: {
          DEFAULT: "#1C1F2A",  // deep charcoal, not pure black
          muted: "#5B6172",     // muted slate — secondary text
          faint: "#6E727D",     // tertiary — darkened twice after measuring: the
                                 // original #9BA0B0 failed even 3:1, and the first
                                 // fix (#737682) passed on white but still fell
                                 // short (4.26:1) against the slightly-darker
                                 // canvas background; see scripts/contrast-audit.mjs
        },
        accent: {
          DEFAULT: "#6D5AE6", // indigo/violet — primary brand
          soft: "#6D5AE614",
          cyan: "#0B8097",     // secondary — darkened again after measuring;
                               // the first light-mode pass (#0E9CB8) only hit
                               // 3.25:1 on white, failing the 4.5:1 body-text bar
                               // for its actual small-text usage (log/timeline labels)
        },
        state: {
          success: "#0C865C", // emerald — darkened after measuring (was 3.39:1, needed 4.5:1)
          warning: "#A16A1B", // amber — darkened after measuring (was 3.64:1, needed 4.5:1)
          error: "#D6365F",   // rose/coral — measured 4.61:1 on white, passes as-is
          running: "#0B8097",
        },
        node: {
          trigger: "#2563EB",   // blue
          agent: "#6D5AE6",     // violet
          tool: "#0E9CB8",      // cyan
          condition: "#B7791F", // amber
          transform: "#4F46E5", // indigo
          approval: "#C2600C",  // orange
          output: "#0E9F6E",    // emerald
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgba(28,31,42,0.04), 0 1px 1px 0 rgba(28,31,42,0.03)",
        panelHover: "0 4px 12px -2px rgba(28,31,42,0.08), 0 2px 4px -2px rgba(28,31,42,0.04)",
        node: "0 1px 3px 0 rgba(28,31,42,0.06), 0 1px 2px -1px rgba(28,31,42,0.04)",
        glow: "0 0 0 1px rgba(109,90,230,0.35), 0 0 20px -6px rgba(109,90,230,0.3)",
      },
      borderRadius: {
        panel: "12px",
        node: "10px",
      },
      animation: {
        pulseRing: "pulseRing 1.6s ease-out infinite",
      },
      keyframes: {
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(11,128,151,0.35)" },
          "100%": { boxShadow: "0 0 0 10px rgba(11,128,151,0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

