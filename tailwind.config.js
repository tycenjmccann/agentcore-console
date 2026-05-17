/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class", // Enable dark mode via class
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
        // Map surface colors to CSS custom properties
        surface: {
          0: "rgb(var(--color-bg-primary))",
          1: "rgb(var(--color-bg-secondary))",
          2: "rgb(var(--color-bg-tertiary))",
          3: "rgb(var(--color-bg-elevated))",
          4: "rgb(var(--color-border-primary))",
        },
      },
      backgroundColor: {
        "surface-0": "rgb(var(--color-bg-primary))",
        "surface-1": "rgb(var(--color-bg-secondary))",
        "surface-2": "rgb(var(--color-bg-tertiary))",
        "surface-3": "rgb(var(--color-bg-elevated))",
      },
      borderColor: {
        "surface-4": "rgb(var(--color-border-primary))",
      },
      textColor: {
        primary: "rgb(var(--color-text-primary))",
        secondary: "rgb(var(--color-text-secondary))",
        tertiary: "rgb(var(--color-text-tertiary))",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
