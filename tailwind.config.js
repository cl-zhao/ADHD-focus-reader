/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'warm-bg': '#FDF8F3',
        'warm-bg-secondary': '#F5F0EB',
        'warm-text': '#3D3632',
        'warm-text-secondary': '#6B635B',
        'warm-accent': '#E8A87C',
        'warm-interactive': '#C49A6C',
      },
      fontFamily: {
        'serif': ['LXGW WenKai', 'Noto Serif SC', 'system-ui', 'serif'],
      },
    },
  },
  plugins: [],
}
