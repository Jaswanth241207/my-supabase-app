/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFBF5', ink: '#1C1917',
        brand: { 50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 500: '#F97316', 600: '#EA580C', 700: '#C2410C' },
        leaf: { 100: '#DCFCE7', 600: '#16A34A', 700: '#15803D' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(28,25,23,.06), 0 4px 16px rgba(28,25,23,.06)' },
    },
  },
  plugins: [],
}
