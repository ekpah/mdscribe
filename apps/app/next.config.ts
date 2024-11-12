import { env } from '@repo/env';
import type { NextConfig } from '@repo/next-config';
import { config, withAnalyzer } from '@repo/next-config';

let nextConfig: NextConfig = { ...config };

if (env.VERCEL) {
  // maybe add, if I decide to use Sentry
  // nextConfig = withSentry(nextConfig);
}

if (env.ANALYZE === 'true') {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
