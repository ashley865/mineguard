/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mine: {
          50: "#1f1a0d",
          100: "#2e2712",
          200: "#423817",
          300: "#5c4d1e",
          400: "#7a6726",
          500: "#a1852f",
          600: "#c2a23e",
          700: "#d9c073",
          800: "#ecdfae",
          900: "#f6f0d9",
          950: "#fbf8ee",
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
