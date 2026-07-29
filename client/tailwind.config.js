/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mine: {
          50: "#0f1a17",
          100: "#1c2f2a",
          200: "#233932",
          300: "#29463c",
          400: "#33574a",
          500: "#456f5f",
          600: "#658c7a",
          700: "#96b4a5",
          800: "#c3d5cb",
          900: "#e3ebe6",
          950: "#f4f7f5",
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
