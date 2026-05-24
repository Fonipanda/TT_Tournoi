/**
 * @tt/config — Preset ESLint partagé pour tout le mono-repo.
 *
 * Usage (dans chaque package consommateur, eslint.config.js) :
 *   const preset = require('@tt/config/eslint-preset');
 *   module.exports = preset;
 */

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/src/generated/**',
      '**/legacy/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-unused-vars': 'off', // géré par @typescript-eslint
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
];
