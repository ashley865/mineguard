/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mine: {
          50: "#0b1220",
          100: "#111a2e",
          200: "#1c2b47",
          300: "#33456b",
          400: "#5b7092",
          500: "#8a9ab5",
          600: "#b9c3d6",
          700: "#d6dce8",
          800: "#eef1f6",
          900: "#f8f9fc",
          950: "#ffffff",
        },
        hazard: {
          400: "#d9a441",
          500: "#c48a1f",
          600: "#a5721a",
        },
        danger: {
          400: "#f3665b",
          500: "#e13b2e",
          600: "#c22a20",
        },
        success: {
          400: "#4ade80",
          500: "#16a34a",
          600: "#15803d",
        },
      },
    },
  },
  plugins: [],
};
