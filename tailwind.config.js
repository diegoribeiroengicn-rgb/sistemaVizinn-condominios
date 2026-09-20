/** @type {import('tailwindcss').Config} */

// navy-50..950 (+DEFAULT) are theme-reactive: their RGB channels come from
// CSS custom properties defined in app/globals.css, which hold different
// values under `:root` (light) vs `:root[data-theme="dark"]` (dark). The
// semantic meaning of each step stays constant across themes (50 = most
// subtle background tint, 900 = strongest text/border), only the actual
// lightness flips — see the comment in globals.css for the full rationale.
// This means every existing `text-navy-900`, `bg-navy-50`,
// `border-navy-100`, etc. across the app automatically adapts to the
// chosen theme with no per-file changes.
function withOpacity(cssVar) {
  return ({ opacityValue }) =>
    opacityValue === undefined ? `rgb(var(${cssVar}))` : `rgb(var(${cssVar}) / ${opacityValue})`;
}

module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./hooks/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: withOpacity("--navy-800"),
          50: withOpacity("--navy-50"),
          100: withOpacity("--navy-100"),
          200: withOpacity("--navy-200"),
          300: withOpacity("--navy-300"),
          400: withOpacity("--navy-400"),
          500: withOpacity("--navy-500"),
          600: withOpacity("--navy-600"),
          700: withOpacity("--navy-700"),
          800: withOpacity("--navy-800"),
          900: withOpacity("--navy-900"),
          950: withOpacity("--navy-950"),
        },
        // Brand accent colors stay fixed across themes on purpose (buttons,
        // badges, the logo) — only the neutral "navy" scale above adapts.
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
          50: withOpacity("--bg-page"),
          100: "#f5f0e8",
          200: "#ece3d3",
        },
        sage: "#a9b7a0",
        // Fixed navy — for solid brand blocks (buttons, active nav pill,
        // hero sections, avatar circles) that must stay dark navy in both
        // themes, unlike the reactive `navy` scale above.
        midnight: "#0a1f3f",
        surface: withOpacity("--surface"),
        // Fundo da barra lateral — igual ao midnight no tema claro, mas
        // muda pra um tom mais claro no tema escuro (ver globals.css) pra
        // continuar contrastando com o fundo da página.
        sidebar: withOpacity("--sidebar-bg"),
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
