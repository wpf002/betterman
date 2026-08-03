import type { Metadata, Viewport } from 'next';
import { chrome, TYPEKIT_KIT_ID } from '@betterman/ui';
import { SiteHeader } from './_components/site-header';
import '@betterman/ui/tokens.css';
import '@betterman/ui/styles.css';
import './globals.css';

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
    <html lang="en">
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
