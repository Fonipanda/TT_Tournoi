/**
 * @tt/ui — Tailwind preset partagé.
 *
 * Usage (dans tailwind.config de chaque app) :
 *   const preset = require('@tt/ui/tailwind-preset');
 *   module.exports = { presets: [preset], content: [...] };
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Surfaces & texte
        bg: '#F8FAFC',
        'bg-alt': '#F1F5F9',
        surface: '#FFFFFF',
        'surface-muted': '#F8FAFC',
        border: '#E2E8F0',
        'border-strong': '#CBD5E1',
        foreground: '#0F172A',
        'foreground-muted': '#475569',
        'foreground-subtle': '#64748B',

        // Accent
        primary: {
          DEFAULT: '#0284C7',
          hover: '#0369A1',
          fg: '#FFFFFF',
          soft: '#E0F2FE',
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },
        accent: {
          DEFAULT: '#06B6D4',
          hover: '#0891B2',
          soft: '#CFFAFE',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
        },

        // États
        success: {
          DEFAULT: '#16A34A',
          soft: '#DCFCE7',
          400: '#4ADE80',
        },
        danger: {
          DEFAULT: '#DC2626',
          soft: '#FEE2E2',
          400: '#F87171',
        },
        warning: {
          DEFAULT: '#D97706',
          soft: '#FEF3C7',
        },

        // Mode TV
        'tv-bg': '#0F172A',
        'tv-fg': '#F8FAFC',
        'tv-accent': '#22D3EE',
      },

      fontFamily: {
        heading: ['Oswald', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        score: ['clamp(48px, 8vw, 96px)', { lineHeight: '1' }],
        'score-tv': ['clamp(96px, 14vw, 192px)', { lineHeight: '1' }],
        heading: ['clamp(24px, 4vw, 48px)', { lineHeight: '1.1' }],
      },

      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
      },

      // Tabular numerals pour scoreboard
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },

      spacing: {
        'touch-target': '48px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
