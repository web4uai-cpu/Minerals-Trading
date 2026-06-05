/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark industrial theme — slate base, ochre accent, sage for verified states
        base: {
          DEFAULT: '#0D1117',
          50: '#161B22',
          100: '#1C2128',
          200: '#21262D',
          300: '#30363D',
          400: '#484F58',
          500: '#6E7681',
        },
        accent: {
          DEFAULT: '#C9943A',
          light: '#E5B85C',
          dark: '#A87A2E',
        },
        sage: {
          DEFAULT: '#56D364',
          light: '#7EE787',
          dark: '#3FB950',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
