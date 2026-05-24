/** @type {import('tailwindcss').Config} */
const preset = require('@tt/ui/tailwind-preset');

module.exports = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
  ],
};
