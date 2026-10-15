import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: [
          "var(--font-barlow-condensed)",
          '"Barlow Condensed"',
          '"Archivo Narrow"',
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-jetbrains-mono)",
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        background: "var(--color-bg)",
        surface: {
          DEFAULT: "var(--color-surface)",
          elevated: "var(--color-surface-elevated)",
          hover: "var(--color-surface-hover)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        pitwall: {
          red: "#E10600",
          redHover: "#C20500",
        },
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
      },
      keyframes: {
        flashUp: {
          "0%, 100%": { backgroundColor: "transparent" },
          "30%": { backgroundColor: "rgba(16, 185, 129, 0.25)" },
        },
        flashDown: {
          "0%, 100%": { backgroundColor: "transparent" },
          "30%": { backgroundColor: "rgba(239, 68, 68, 0.25)" },
        },
      },
      animation: {
        "flash-up": "flashUp 1.2s ease-in-out",
        "flash-down": "flashDown 1.2s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
