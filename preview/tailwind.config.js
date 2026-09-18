/** @type {import('tailwindcss').Config} */
export default {
  // Scans the real sources so production ships only the classes Brief uses,
  // instead of the whole framework from a CDN on every page load.
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // The type floor, in ONE place. The old app set 9-11px by hand across
    // ~2,500 call sites; remapping the named scale lifts 1,161 `text-xs`
    // usages without touching them, which is what makes the floor real rather
    // than a rule in a document nobody follows.
    extend: {
      fontSize: {
        xs: ['13px', { lineHeight: '1.45' }],
        sm: ['15px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.55' }],
        lg: ['18px', { lineHeight: '1.45' }],
        xl: ['22px', { lineHeight: '1.3' }],
        '2xl': ['26px', { lineHeight: '1.25' }],
        '3xl': ['30px', { lineHeight: '1.2' }],
        '4xl': ['34px', { lineHeight: '1.15' }],
        '5xl': ['40px', { lineHeight: '1.1' }]
      }
    }
  },
  plugins: []
};
