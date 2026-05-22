/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        surface: {
          0: "var(--color-surface-0)",
          1: "var(--color-surface-1)",
          2: "var(--color-surface-2)",
          3: "var(--color-surface-3)",
          4: "var(--color-surface-4)",
        },
        "theme-bg-primary": "var(--color-bg-primary)",
        "theme-bg-secondary": "var(--color-bg-secondary)",
        "theme-surface": "var(--color-surface)",
        "theme-surface-elevated": "var(--color-surface-elevated)",
        "theme-text-primary": "var(--color-text-primary)",
        "theme-text-secondary": "var(--color-text-secondary)",
        "theme-text-muted": "var(--color-text-muted)",
        "theme-border": "var(--color-border)",
        "theme-accent": "var(--color-accent)",
        "theme-accent-hover": "var(--color-accent-hover)",
        "theme-accent-subtle": "var(--color-accent-subtle)",
        "theme-success": "var(--color-success)",
        "theme-warning": "var(--color-warning)",
        "theme-error": "var(--color-error)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
