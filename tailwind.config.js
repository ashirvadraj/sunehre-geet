/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          dark: '#0e0b16',
          surface: '#18122B',
          card: '#22194D',
          gold: '#E5A93C',
          amber: '#F39C12',
          cream: '#FFF4E0',
          muted: '#9B90B2',
          accent: '#D97706'
        }
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 18s linear infinite',
      }
    },
  },
  plugins: [],
}
