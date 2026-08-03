/**
 * Typed mirror of tokens.css, for code that needs a value rather than a var()
 * (PWA manifest theme color, push notification badges, OG image generation).
 *
 * Every value was sampled — from betterman.com's rendered CSS, the HubSpot
 * email source, or the Substack theme configs. Do not invent brand colors.
 */

export const chrome = {
  bone: '#F1F0EC',
  ink: '#1E1E1E',
  mute: '#71706C',
  hair: '#DCDAD3',
  paper: '#FFFFFF',
  clay: '#C28154',
  clayDeep: '#A66B42',
} as const;

export const skins = {
  bettermornings: {
    bg: '#1E2B33',
    text: '#FFFFFF',
    give: '#37761D',
    connect: '#8F5A36',
    subscribe: '#F1C233',
  },
  goodTrouble: {
    bg: '#FFFFFF',
    text: '#363737',
    accent: '#E85C57',
  },
  josiahJones: {
    bg: '#FFFFFF',
    text: '#363737',
    accent: '#FF6719',
  },
} as const;

/** Maps a publication route segment to its panel class in tokens.css. */
export const SKIN_CLASS = {
  bettermornings: 'skin-bettermornings',
  'good-trouble': 'skin-good-trouble',
  'josiah-jones': 'skin-josiah-jones',
} as const;

export type SkinSlug = keyof typeof SKIN_CLASS;

/** The source panel is 600px wide on every reading page (spec §3). */
export const PANEL_WIDTH = 600;

/** Adobe Fonts kit serving neue-haas-grotesk-display / -text. */
export const TYPEKIT_KIT_ID = 'sbo2xxd';
