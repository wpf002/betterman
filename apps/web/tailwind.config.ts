import type { Config } from 'tailwindcss';
import preset from '@betterman/config/tailwind';

export default {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
