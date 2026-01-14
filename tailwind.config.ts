import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
        },
        success: {
          DEFAULT: '#22c55e',
          hover: '#16a34a',
        },
        error: {
          DEFAULT: '#ef4444',
          hover: '#dc2626',
        },
        combo: {
          DEFAULT: '#f59e0b',
          glow: '#fbbf24',
        },
      },
    },
  },
  plugins: [],
};

export default config;
