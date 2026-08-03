/**
 * BetterMan Reader — shared Tailwind preset.
 *
 * Two disjoint token namespaces, per spec §13:
 *   - CHROME  (bone/ink/mute/hair/paper/clay) — app shell only.
 *   - SKINS   (bm-* / gt-* / jj-*)            — inside a source panel only.
 * Never mix them. Every value here was sampled from betterman.com's rendered
 * CSS, the HubSpot email source, or the Substack theme config.
 */

/** BetterMan app chrome — sampled from betterman.com computed styles. */
const chrome = {
  bone: '#F1F0EC',
  ink: '#1E1E1E',
  mute: '#71706C',
  hair: '#DCDAD3',
  paper: '#FFFFFF',
  clay: '#C28154',
  'clay-deep': '#A66B42',
};

/** Skin A — BetterMornings, from the HubSpot email source. */
const bettermornings = {
  'bm-bg': '#1E2B33',
  'bm-text': '#FFFFFF',
  'bm-give': '#37761D',
  'bm-connect': '#8F5A36',
  'bm-sub': '#F1C233',
};

/** Skin B — Good Trouble, from charper.substack.com theme. */
const goodTrouble = {
  'gt-bg': '#FFFFFF',
  'gt-text': '#363737',
  'gt-accent': '#E85C57',
};

/** Skin C — Josiah Jones, from josiahjones1.substack.com theme. */
const josiahJones = {
  'jj-bg': '#FFFFFF',
  'jj-text': '#363737',
  'jj-accent': '#FF6719',
};

/**
 * Adobe Fonts kit `sbo2xxd` (linked publicly from betterman.com) serves
 * neue-haas-grotesk-display, neue-haas-grotesk-text and linotype-sabon.
 * It does NOT contain proxima-nova, so -text is the secondary face.
 */
const CHROME_SANS = [
  'neue-haas-grotesk-display',
  '"Helvetica Neue"',
  'Helvetica',
  'Arial',
  'sans-serif',
];
const CHROME_TEXT = [
  'neue-haas-grotesk-text',
  '"Helvetica Neue"',
  'Helvetica',
  'Arial',
  'sans-serif',
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: { ...chrome, ...bettermornings, ...goodTrouble, ...josiahJones },

      fontFamily: {
        // Chrome
        display: CHROME_SANS,
        text: CHROME_TEXT,
        // Skin A renders in the email's own stack.
        'bm-email': ['Arial', 'Helvetica', 'sans-serif'],
        // Skins B/C: Substack sans headings; JJ body is Spectral (serif).
        substack: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        spectral: ['Spectral', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },

      fontSize: {
        // Chrome — headings are LIGHT (300–400); never 700+ on a headline.
        eyebrow: ['12px', { lineHeight: '1.4', letterSpacing: '2px', fontWeight: '700' }],
        body: ['17px', { lineHeight: '1.65' }],
        'display-sm': ['28px', { lineHeight: '1.15', fontWeight: '300' }],
        'display-md': ['40px', { lineHeight: '1.08', fontWeight: '300' }],
        'display-lg': ['56px', { lineHeight: '1.02', fontWeight: '300' }],
      },

      maxWidth: {
        /** The 600px source panel — every reading page. */
        panel: '600px',
        /** Chrome reading measure. */
        measure: '36rem',
        shell: '1200px',
      },

      borderRadius: {
        /** Chrome CTA — betterman.com uses a full pill. */
        pill: '999px',
        /** Skin A CTA — the email's own 25px radius. */
        'bm-pill': '25px',
      },

      borderColor: { DEFAULT: chrome.hair },
    },
  },
  plugins: [],
};

module.exports.tokens = { chrome, bettermornings, goodTrouble, josiahJones };
