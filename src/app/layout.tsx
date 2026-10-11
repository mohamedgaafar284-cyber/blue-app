import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { headers } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { CsrfProvider } from "@/components/providers/csrf-provider";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { SafeWebSocketProvider } from "@/lib/websocket/safe-websocket-provider";
import { SkipNavLink } from "@/components/common/accessible-components";
import CookieConsent from "@/components/common/cookie-consent";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { DemoBanner } from "@/components/demo-banner";
const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BluePrint - نظام إدارة مكاتب الاستشارات الهندسية",
  description: "نظام متكامل لإدارة مكاتب الاستشارات الهندسية في الإمارات | Integrated Engineering Consultancy Management System for UAE",
  keywords: ["BluePrint", "engineering", "consultancy", "UAE", "management", "إدارة", "هندسة", "استشارات", "الإمارات"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BluePrint",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2557",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();
  // SECURITY: Read the per-request CSP nonce forwarded by the proxy middleware.
  // The nonce is generated in src/auth-proxy.ts and attached to the request
  // headers so server components can embed it in <script nonce="..."> tags.
  // Without this, the inline language-detection script below would be blocked
  // by the browser's CSP enforcement (script-src 'self' 'nonce-<random>').
  // Falls back to an empty nonce for static/SSG-rendered pages where middleware
  // has not run — in that case the script tag is omitted to avoid a CSP violation.
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? "";
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Leaflet CSS imported locally via 'leaflet/dist/leaflet.css' in globals.css or component */}
        {/* Security headers are set centrally by src/proxy.ts — no duplicate meta tags needed */}
        {/* Language detection script — prevents FOUC (flash of unstyled content).
            SECURITY: This inline script contains only static code that reads from
            localStorage/cookies and sets document direction. No user input is interpolated.
            The nonce attribute is required by the CSP `script-src 'nonce-<random>'` directive
            enforced by the proxy middleware. The nonce is generated per-request and is NOT
            exposed in any response header — only embedded server-side in this tag — so XSS
            payloads cannot read it. If the nonce is missing (e.g., during SSG), the script
            is omitted to avoid a CSP violation; the React app will re-apply direction on mount. */}
        {nonce ? (
          <Script
            id="lang-script"
            strategy="beforeInteractive"
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var m=document.cookie.match(/(^| )blueprint-lang=([^;]+)/);var l=m?m[2]:(localStorage.getItem("blueprint-lang")||"ar");document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr"}catch(e){}})()`,
            }}
          />
        ) : null}
      </head>
      <body
        className={`${ibmPlexArabic.variable} ${plusJakarta.variable} antialiased bg-background text-foreground font-[family-name:var(--font-ibm-plex-arabic)] ${process.env.DEMO_MODE === "true" ? "has-demo-banner" : ""}`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} disableTransitionOnChange>
          <ReactQueryProvider>
            <CsrfProvider>
              <SafeWebSocketProvider>
                <ErrorBoundary>
                  <NextIntlClientProvider messages={messages}>
                    <SkipNavLink />
                    {process.env.DEMO_MODE === "true" && <DemoBanner />}
                    {children}
                    <CookieConsent />
                    <Toaster position="top-right" richColors closeButton />
                  </NextIntlClientProvider>
                </ErrorBoundary>
              </SafeWebSocketProvider>
            </CsrfProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
