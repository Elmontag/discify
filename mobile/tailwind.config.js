/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#07111f',
        surface: '#0d1e33',
        accent: '#7c5cff',
        accent2: '#00c2ff',
        text: '#f5f7ff',
        muted: '#9eaccf',
        success: '#86f0c9',
      },
    },
  },
  plugins: [],
};
