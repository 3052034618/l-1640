/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['DM Sans', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#1E3A5F',
          light: '#2A4F7F',
          dark: '#152B47',
        },
      },
    },
  },
  plugins: [],
};
