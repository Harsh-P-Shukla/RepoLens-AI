/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        ink: '#07090d',
        panel: '#0d1117',
        cyanLens: '#67e8f9',
        mintLens: '#6ee7b7',
        amberLens: '#fbbf24',
        roseLens: '#fb7185'
      },
      boxShadow: {
        glow: '0 0 42px rgba(103, 232, 249, 0.14)',
        panel: '0 22px 80px rgba(0, 0, 0, 0.36)'
      }
    }
  },
  plugins: []
};

