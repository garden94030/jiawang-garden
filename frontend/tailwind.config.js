/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 主色：深海軍藍（精品感）
        navy: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
        },
        // 輔色：象牙金（高端感）
        warm: {
          50:  '#fffbf0',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#e8c96a',
          400: '#c9a227',
          500: '#a07818',
          600: '#7c5c0e',
        },
        // 向下相容 primary → navy
        primary: {
          50:  '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          400: '#829ab1',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
        },
        surface: {
          DEFAULT: '#fafaf8',
          100: '#f6f6f4',
          200: '#ebebea',
        },
      },
      fontFamily: {
        sans:  ['"Noto Sans TC"', '"Inter"', 'sans-serif'],
        serif: ['"Playfair Display"', '"Noto Serif TC"', 'serif'],
      },
      letterSpacing: {
        ultra: '0.35em',
      },
      animation: {
        'fade-up': 'fadeUp 0.7s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
