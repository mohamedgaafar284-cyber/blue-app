import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Sentry integration — conditional import to prevent build failure
// when @sentry/nextjs is not installed (e.g., in lightweight setups)
let withSentryConfig: ((config: NextConfig, opts?: Record<string, unknown>) => NextConfig) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sentryModule = require('@sentry/nextjs');
  withSentryConfig = sentryModule.withSentryConfig;
} catch {
  // @sentry/nextjs not installed — export config as-is
}

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Allow local LAN IPs (like mobile testing over Wi-Fi) without CORS / HMR blocks
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
  ],

  // NOTE: We use Webpack for dev (see package.json "dev" script with --webpack flag).
  // Turbopack (Next.js 16 default) has a Windows-specific bug that creates
  // phantom [[...slug]] catch-all routes, causing route specificity conflicts.
  // DO NOT remove --webpack from the dev script unless the Turbopack bug is fixed.

  // Optimize barrel-file imports to reduce chunk sizes and avoid ChunkLoadError
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
    optimizePackageImports: [
      'recharts',
      'framer-motion',
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'date-fns',
      'react-day-picker',
      'embla-carousel-react',
    ],
  },

  // Packages that must not be bundled for the client
  serverExternalPackages: [
    'bcryptjs',
    'winston',
    'winston-daily-rotate-file',
    'redis',
    'socket.io',
    'nodemailer',
    'sharp',
    '@prisma/client',
    // 'jose' must NOT be here — it needs to be bundled for Edge Runtime proxy
    // 'jose',
    'otplib',
    'z-ai-web-dev-sdk',
    'swagger-jsdoc',
  ],

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Blue',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.stripe.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  webpack: (config, { webpack, isServer }) => {
    // Fix UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:/,
        (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, '');
        }
      )
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    return config;
  }
};

// Wrap with Sentry if available, otherwise export as-is
const finalConfig = withSentryConfig
  ? withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
    sourcemaps: {
      disable: true,
    },
    webpack: {
      reactComponentAnnotation: {
        enabled: true,
      },
      treeshake: {
        removeDebugLogging: true,
      },
      automaticVercelMonitors: true,
    },
  })
  : nextConfig;

// PWA Serwist setup
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/~offline", revision: "1" },
  ],
});

export default withNextIntl(withSerwist(finalConfig));
