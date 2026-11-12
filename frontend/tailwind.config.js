/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core dark palette
        surface: {
          DEFAULT: '#0d1117',
          elevated: '#161b22',
          card: '#1c2128',
          hover: '#252b33',
          border: '#2d333b',
        },
        // Tennis-ball lime accent
        accent: {
          DEFAULT: '#c8e64e',
          hover: '#d4ed6d',
          muted: '#8ba832',
          dim: '#4a5e1a',
        },
        // Surface badges
        hard: { DEFAULT: '#3b82f6', light: '#60a5fa' },
        clay: { DEFAULT: '#e8773a', light: '#f09d6a' },
        grass: { DEFAULT: '#22c55e', light: '#4ade80' },
        indoor: { DEFAULT: '#8b5cf6', light: '#a78bfa' },
        // Text
        text: {
          primary: '#f0f6fc',
          secondary: '#8b949e',
          muted: '#6e7681',
          accent: '#c8e64e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        badge: '8px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
