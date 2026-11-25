/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
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
