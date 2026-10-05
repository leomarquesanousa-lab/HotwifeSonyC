import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  redirects() {
    return [
      { source: '/meus-videos', destination: '/my-videos', permanent: true },
      { source: '/conta', destination: '/account', permanent: true },
      // Keep existing bookmarks and email links working without a visible locale.
      { source: '/:locale([a-z]{2}(?:-[A-Za-z]{2})?)/:path*', destination: '/:path*', permanent: true },
    ];
  },
  rewrites() {
    return {
      // Retain the existing route tree and providers behind English-only URLs.
      beforeFiles: [
        { source: '/app/:path*', destination: '/en-US/app/:path*' },
        { source: '/onboarding/:path*', destination: '/en-US/onboarding/:path*' },
        ...['login', 'sign-up', 'forgot-password', 'reset-password', 'verify-email', 'resend-verification'].map(route => ({
          source: `/${route}`, destination: `/en-US/${route}`,
        })),
        { source: '/my-videos', destination: '/meus-videos' },
        { source: '/account', destination: '/conta' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  outputFileTracingIncludes: {
    "/api/platforms/manyvids/*": [
      "./node_modules/playwright/**/*",
      "./node_modules/playwright-core/**/*",
    ],
  },
};

export default withNextIntl(nextConfig);
