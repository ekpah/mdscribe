import withBundleAnalyzer from "@next/bundle-analyzer";
// @ts-expect-error No declaration file
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import { env } from "@repo/env";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { createJiti } from "jiti";
import type { NextConfig } from "next";
import { createSecureHeaders } from "next-secure-headers";

const jiti = createJiti(import.meta.url);

import markdocConfig from "@markdoc/next.js";

export const withMarkdoc = markdocConfig()({
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
});

export type { NextConfig };

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti.import("@repo/env");

export const config: NextConfig = withVercelToolbar()({
	images: {
		formats: ["image/avif", "image/webp"],
	},

	// biome-ignore lint/suspicious/useAwait: headers is async
	async headers() {
		return [
			{
				source: "/(.*)",
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

let nextConfig: NextConfig = { ...config };

if (env.VERCEL) {
	// maybe add, if I decide to use Sentry
	// nextConfig = withSentry(nextConfig);
}

if (env.ANALYZE === "true") {
	nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
