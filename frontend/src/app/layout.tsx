import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
    title: 'TrueOdds — Smart Sports Analytics Tools',
    description:
        'Real-time arbitrage, +EV Analytics tools, and odds comparison across 100+ sportsbooks.',
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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <meta
                    name="p:domain_verify"
                    content="ceef67d058c442466bf56a6a60ea37ca"
                />
            </head>

            <body>
                <ThemeProvider>
                    <AuthProvider>{children}</AuthProvider>
                </ThemeProvider>

                {/* Google Analytics */}
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-YNFT85DCXK"
                    strategy="afterInteractive"
                />

                <Script
                    id="google-analytics"
                    strategy="afterInteractive"
                >
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', 'G-YNFT85DCXK');
                    `}
                </Script>

                {/* Meta Pixel */}
               {/* Meta / Facebook Pixel */}

<Script
    id="facebook-pixel-loader"
    src="https://connect.facebook.net/en_US/fbevents.js"
    strategy="afterInteractive"
/>

<Script
    id="facebook-pixel-init"
    strategy="afterInteractive"
>
    {`
        window.fbq = window.fbq || function() {
            window.fbq.callMethod
                ? window.fbq.callMethod.apply(window.fbq, arguments)
                : window.fbq.queue.push(arguments);
        };

        if (!window._fbq) {
            window._fbq = window.fbq;
        }

        window.fbq.push = window.fbq;
        window.fbq.loaded = true;
        window.fbq.version = '2.0';
        window.fbq.queue = [];

        window.fbq('init', '1072228152246140');
        window.fbq('track', 'PageView');
    `}
</Script>

<noscript>
    <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        src="https://www.facebook.com/tr?id=1072228152246140&ev=PageView&noscript=1"
        alt=""
    />
</noscript>
            </body>
        </html>
    );
}
