import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'TrueOdds — Smart Sports Analytics Tools',
  description:
    'Real-time arbitrage, +EV Analytics tools, and odds comparison across 100+ sportsbooks.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#080b12' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>

        {/* Meta Pixel */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
        >
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');

            fbq('init', '1072228152246140');
            fbq('track', 'PageView');
          `}
        </Script>

        {/* Meta Pixel noscript fallback */}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1072228152246140&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>

      </body>
    </html>
  )
}
