/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        g: {
          1: '#0b0c10',
          2: '#17181c',
          3: '#212227',
          4: '#272931',
          5: '#2e3039',
          6: '#373944',
          7: '#444754',
          8: '#5c6072',
          9: '#888991',
          10: '#898b91',
          11: '#b2b3ba',
          12: '#edeef2',
        },
        surface: {
          panel: '#18171cbf',
          opaque: '#18171ccc',
          action: '#18171c1a',
          footer: '#18171c66',
        },
        blue: {
          primary: '#0544a9',
          hover: '#0d4fbb',
          glow: '#0c44a1',
          screen: '#6EC0F2',
        },
        accent: {
          green: '#3DB985',
          red: '#bb3232',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
      }
    },
  },
  plugins: [],
}
