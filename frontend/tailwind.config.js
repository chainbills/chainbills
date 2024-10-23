/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'selector',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': 'var(--app-bg)',
        primary: '#057ec5',
        'purple-light': '#eae6fe',
      },
    },
  },
  plugins: [require('tailwindcss-primeui')],
};
