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
        flux: {
          bg: 'var(--flux-bg)',
          surface: 'var(--flux-surface)',
          'surface-subtle': 'var(--flux-surface-subtle)',
          border: 'var(--flux-border)',
          'border-strong': 'var(--flux-border-strong)',
          primary: 'var(--flux-primary)',
          secondary: 'var(--flux-secondary)',
          accent: '#635BFF',
          'accent-hover': '#5248EE',
          'accent-light': 'rgba(99, 91, 255, 0.08)',
          success: '#16A36A',
          'success-light': 'rgba(22, 163, 106, 0.08)',
          error: '#E5484D',
          'error-light': 'rgba(229, 72, 77, 0.08)',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ]
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'elevated': '0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 24px -4px rgba(99, 91, 255, 0.25)',
      },
      keyframes: {
        pulseSlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(0.98)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      },
      animation: {
        'pulse-slow': 'pulseSlow 3s ease-in-out infinite',
        'scan': 'scanLine 2s linear infinite',
      }
    },
  },
  plugins: [],
}
