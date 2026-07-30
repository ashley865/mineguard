/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mine: {
          50: "#0a0a0a",
          100: "#18181b",
          200: "#27272a",
          300: "#3f3f46",
          400: "#71717a",
          500: "#a1a1aa",
          600: "#d4d4d8",
          700: "#e4e4e7",
          800: "#f4f4f5",
          900: "#fafafa",
          950: "#ffffff",
        },
        brand: {
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        hazard: {
          400: "#f5b23c",
          500: "#e89b1c",
          600: "#c97e0f",
        },
        danger: {
          400: "#f3665b",
          500: "#e13b2e",
          600: "#c22a20",
        },
      },
    },
  },
  plugins: [],
};
