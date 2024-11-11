import { env } from '@repo/env';
import { config, withAnalyzer } from '@repo/next-config';
import type { NextConfig } from 'next';

let nextConfig: NextConfig = { ...config };

if (env.VERCEL) {
  // maybe add, if I decide to use Sentry
  // nextConfig = withSentry(nextConfig);
}

if (env.ANALYZE === 'true') {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;