import type { Metadata, Viewport } from 'next';
import { Spectral } from 'next/font/google';
import { chrome, TYPEKIT_KIT_ID } from '@betterman/ui';
import { SiteHeader } from './_components/site-header';
import '@betterman/ui/tokens.css';
import '@betterman/ui/styles.css';
import '@betterman/ui/skins.css';
import './globals.css';

/**
 * Josiah Jones' body face (spec §7). Self-hosted by next/font rather than
 * linked, so the reading panel still renders correctly offline once the PWA
 * caches it (Phase 4).
 */
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'BetterMan Reader',
    template: '%s · BetterMan Reader',
  },
  description:
    'BetterMornings, Good Trouble and Josiah Jones — three publications, one place to read them.',
};

export const viewport: Viewport = {
  themeColor: chrome.bone,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const kitId = process.env.NEXT_PUBLIC_TYPEKIT_KIT_ID ?? TYPEKIT_KIT_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spectral.variable}>
      <head>
        {/* Adobe Fonts — neue-haas-grotesk-display / -text. The stack in
            tokens.css stands alone if this fails to load. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="" />
        <link rel="stylesheet" href={`https://use.typekit.net/${kitId}.css`} />
      </head>
      <body className="bm-shell min-h-dvh">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
