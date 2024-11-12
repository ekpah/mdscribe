import withBundleAnalyzer from '@next/bundle-analyzer';

// @ts-expect-error No declaration file
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';
import withVercelToolbar from '@vercel/toolbar/plugins/next';
import type { NextConfig } from 'next';
import { createSecureHeaders } from 'next-secure-headers';

import markdocConfig from '@markdoc/next.js';

export const withMarkdoc = markdocConfig()({
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdoc'],
});

export type { NextConfig };

export const config: NextConfig = withVercelToolbar()({
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // biome-ignore lint/suspicious/useAwait: headers is async
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: createSecureHeaders({
          // HSTS Preload: https://hstspreload.org/
          forceHTTPSRedirect: [
            true,
            { maxAge: 63_072_000, includeSubDomains: true, preload: true },
          ],
        }),
      },
    ];
  },

  webpack(config, { isServer }) {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    return config;
  },

  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
});

export const withAnalyzer = (sourceConfig: NextConfig): NextConfig =>
  withBundleAnalyzer()(sourceConfig);
