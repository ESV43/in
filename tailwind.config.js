/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00e5ff',
        'neon-blue': '#3b82f6',
        'dark-bg': '#020617', // slate-950
        'panel-bg': '#0f172a', // slate-900
        'border-color': '#1e293b', // slate-800
      },
      boxShadow: {
        'neon-glow': '0 0 5px #00e5ff, 0 0 10px #00e5ff, 0 0 15px #00e5ff',
        'neon-glow-blue': '0 0 5px #3b82f6, 0 0 10px #3b82f6',
      }
    },
  },
  plugins: [],
}
