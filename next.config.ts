import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/platforms/manyvids/*": [
      "./node_modules/playwright/**/*",
      "./node_modules/playwright-core/**/*",
    ],
  },
};

export default withNextIntl(nextConfig);
