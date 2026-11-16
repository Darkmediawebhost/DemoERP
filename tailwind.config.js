/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        card: 'var(--card)',
        ink: 'var(--ink)',
        secondary: 'var(--secondary)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        lime: '#92E622',
        tint: 'var(--tint)',
        success: '#16A34A',
        danger: '#DC2626',
        black: '#111111',
        darkbg: '#171717',
        darkline: '#303030',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 17, 17, 0.04)',
      },
    },
  },
  plugins: [],
};
