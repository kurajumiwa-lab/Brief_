/** @type {import('tailwindcss').Config} */
export default {
  // Scans the real sources so production ships only the classes Brief uses,
  // instead of the whole framework from a CDN on every page load.
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: []
};
