/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ivory: {
          DEFAULT: '#FDFBF7',
          surface: '#FBF9F5',
          muted: '#F5F3EF',
          chip: '#E4E2DE',
        },
        forest: {
          DEFAULT: '#166534',
          sage: '#3F6A52',
          soft: '#ECF3EF',
          border: '#86EFAC',
        },
        crimson: {
          DEFAULT: '#991B1B',
          soft: '#FEE2E2',
          border: '#FECACA',
        },
        coffee: {
          50: '#fbf7f4',
          100: '#f5eee6',
          200: '#ebd9cb',
          300: '#ddbea5',
          400: '#cb9e7b',
          500: '#b87d55',
          600: '#a36544',
          700: '#844f37',
          800: '#6d4230',
          900: '#5a3729',
          950: '#321c14',
        },
      },
    },
  },
  plugins: [],
};
