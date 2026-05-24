import type { Metadata, Viewport } from 'next';
import { Oswald, Manrope } from 'next/font/google';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import './globals.css';

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TT Tournoi — Chelles Tennis de Table',
    template: '%s · TT Tournoi',
  },
  description:
    'Plateforme de gestion de tournois de tennis de table — Chelles TT. Live, inscriptions, classements FFTT.',
  applicationName: 'TT Tournoi',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0284C7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${oswald.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-bg text-foreground">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
