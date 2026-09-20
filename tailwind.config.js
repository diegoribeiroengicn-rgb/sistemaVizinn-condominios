/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./hooks/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vizinn brand palette, sampled from the official logo/wordmark
        navy: {
          DEFAULT: "#0a1f3f",
          50: "#eef1f6",
          100: "#d3daea",
          200: "#a7b5d4",
          300: "#7b90bd",
          400: "#4f6ba7",
          500: "#2c4a86",
          600: "#16305f",
          700: "#12263f",
          800: "#0a1f3f",
          900: "#031c48",
          950: "#020f28",
        },
        coral: {
          DEFAULT: "#e45d4e",
          50: "#fdf1ef",
          100: "#fbdcd7",
          200: "#f6b5ab",
          300: "#f18d7e",
          400: "#e97564",
          500: "#e45d4e",
          600: "#cc4536",
          700: "#a8362a",
          800: "#832a21",
          900: "#5f1e18",
        },
        cream: {
          DEFAULT: "#f5f0e8",
          50: "#fdfcfa",
          100: "#f5f0e8",
          200: "#ece3d3",
        },
        sage: "#a9b7a0",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px -10px rgba(3, 28, 72, 0.25)",
      },
    },
  },
  plugins: [],
};
