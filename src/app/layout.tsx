import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, Spectral } from 'next/font/google';

import { DevBanner } from '@/components/dev-banner';
import { DownloadZipButton } from '@/components/DownloadZipButton';
import { siteUrl } from '@/lib/seo';
import { site } from '@/lib/site';

import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await siteUrl()),
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description,
    icons: { icon: site.logo || '/site-icon.svg' },
  };
}

const heading = Cinzel({ subsets: ['latin'], variable: '--font-heading', weight: ['400', '600', '700', '900'] });
const body = Spectral({ subsets: ['latin'], variable: '--font-body', weight: ['300', '400', '600'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${heading.variable} ${body.variable}`} lang="es">
      <body className="flex min-h-dvh flex-col bg-[#07090c] font-sans text-stone-200 antialiased">
        <div className="flex-1">{children}</div>
        <DownloadZipButton />
        <DevBanner />
      </body>
    </html>
  );
}
