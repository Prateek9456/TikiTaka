/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          muted: 'rgb(var(--accent-muted) / <alpha-value>)',
          glow: 'rgb(var(--accent-glow) / <alpha-value>)',
          dim: 'rgb(var(--accent-dim) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        chart: {
          cyan: '#22d3ee',
          violet: '#a78bfa',
          amber: '#fbbf24',
          rose: '#fb7185',
        },
      },
      fontFamily: {
        sans: ['Rajdhani', 'system-ui', 'sans-serif'],
        display: ['Orbitron', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 32px -8px rgb(var(--accent) / 0.55)',
        'glow-sm': '0 0 18px -6px rgb(var(--accent) / 0.45)',
        panel: '0 24px 60px -28px rgb(0 0 0 / 0.75)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 3s ease-in-out infinite alternate',
        shimmer: 'shimmer 2.5s linear infinite',
        scan: 'scan 6s linear infinite',
        'spin-slow': 'spin 12s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        glow: {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '0.9' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgb(var(--accent) / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--accent) / 0.04) 1px, transparent 1px)',
        hex: 'radial-gradient(circle at 1px 1px, rgb(var(--accent) / 0.12) 1px, transparent 0)',
      },
      backgroundSize: {
        grid: '44px 44px',
        hex: '22px 22px',
      },
    },
  },
  plugins: [],
};
