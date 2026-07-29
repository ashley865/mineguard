/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        mine: {
          50: "#f4f7f5",
          100: "#e3ebe6",
          200: "#c3d5cb",
          300: "#96b4a5",
          400: "#658c7a",
          500: "#456f5f",
          600: "#33574a",
          700: "#29463c",
          800: "#233932",
          900: "#1c2f2a",
          950: "#0f1a17",
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
