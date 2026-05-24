/**
 * @tt/ui — Design tokens partagés.
 *
 * Style "Performance Pro" inversé : fond clair + palette froide (sky/cyan)
 * adapté aux écrans de gymnase tout en conservant les principes du dépôt B :
 *  - Typographies Oswald (headings) + Manrope (body)
 *  - Coins sharp (radius max 4px)
 *  - Scoreboard XL avec tabular-nums (lisible à 5m)
 *  - Codage couleur tables : libre = vert, occupée = rouge
 */

export const tokens = {
  color: {
    // Fond global
    bg: '#F8FAFC', // slate-50
    bgAlt: '#F1F5F9', // slate-100 — sections alternées
    surface: '#FFFFFF', // cartes
    surfaceMuted: '#F8FAFC',
    border: '#E2E8F0', // slate-200
    borderStrong: '#CBD5E1', // slate-300
    foreground: '#0F172A', // slate-900 — texte principal
    foregroundMuted: '#475569', // slate-600
    foregroundSubtle: '#64748B', // slate-500

    // Accent principal (palette froide)
    primary: '#0284C7', // sky-600
    primaryHover: '#0369A1', // sky-700
    primaryFg: '#FFFFFF',
    primarySoft: '#E0F2FE', // sky-100 — backgrounds doux
    accent: '#06B6D4', // cyan-500 — accent live
    accentHover: '#0891B2', // cyan-600
    accentSoft: '#CFFAFE', // cyan-100

    // États
    success: '#16A34A', // green-600 — table libre
    successSoft: '#DCFCE7', // green-100
    danger: '#DC2626', // red-600 — table occupée, erreurs
    dangerSoft: '#FEE2E2', // red-100
    warning: '#D97706', // amber-600
    warningSoft: '#FEF3C7', // amber-100

    // Mode TV — fond sombre contrasté pour gymnase
    tvBg: '#0F172A', // slate-900
    tvFg: '#F8FAFC',
    tvAccent: '#22D3EE', // cyan-400 — plus lumineux
    tvSuccess: '#4ADE80', // green-400
    tvDanger: '#F87171', // red-400

    // Score
    scoreBg: '#0F172A',
    scoreFg: '#F8FAFC',
    scoreWinner: '#22D3EE',
  },

  font: {
    heading: '"Oswald", system-ui, sans-serif',
    body: '"Manrope", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },

  // Coins SHARP obligatoires (look "hardware scoreboard")
  radius: {
    none: '0px',
    sm: '2px',
    md: '4px',
  },

  fontSize: {
    score: 'clamp(48px, 8vw, 96px)',
    scoreTV: 'clamp(96px, 14vw, 192px)',
    heading: 'clamp(24px, 4vw, 48px)',
  },

  // Touch targets minimum (WCAG + admin tactile)
  spacing: {
    touchTarget: '48px',
  },

  // Breakpoints (alignés Tailwind par défaut)
  breakpoint: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

export type ColorToken = keyof typeof tokens.color;
