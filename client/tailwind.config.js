/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mine: {
          50: "#18181b",
          100: "#27272a",
          200: "#3f3f46",
          300: "#52525b",
          400: "#8a6d1a",
          500: "#a5811f",
          600: "#c49a2e",
          700: "#dbb457",
          800: "#e5e5e5",
          900: "#fafafa",
          950: "#ffffff",
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
