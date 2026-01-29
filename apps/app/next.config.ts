import withBundleAnalyzer from "@next/bundle-analyzer";
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

	// Externalize PGlite to prevent bundling issues with WASM file resolution
	serverExternalPackages: ["@electric-sql/pglite"],

	// PERF: Optimize barrel file imports (15-70% faster dev boot, 28% faster builds)
	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"@radix-ui/react-icons",
			"date-fns",
			"@repo/design-system",
		],
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
});

let nextConfig: NextConfig = { ...config };

export default nextConfig;
