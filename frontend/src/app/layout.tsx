import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
export const metadata: Metadata = {
    title: 'TrueOdds — Smart Sports Betting Tools',
    description: 'Real-time arbitrage, +EV betting tools, and odds comparison across 100+ sportsbooks.',
};
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
        { media: '(prefers-color-scheme: dark)', color: '#080b12' },
        { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    ],
};
export default function RootLayout({ children, }: {
    children: React.ReactNode;
}) {
    return (<html lang="en">
      <head>
        <meta name="p:domain_verify" content="ceef67d058c442466bf56a6a60ea37ca"/>
      </head>

      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>

        <Script src="https://www.googletagmanager.com/gtag/js?id=G-YNFT85DCXK" strategy="afterInteractive"/>

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YNFT85DCXK');
          `}
        </Script>
      </body>
    </html>);
}
