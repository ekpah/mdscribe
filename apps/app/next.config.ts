import { resolve } from "node:path";
import markdocConfig from "@markdoc/next.js";
import { createJiti } from "jiti";
import type { NextConfig } from "next";
import { createSecureHeaders } from "next-secure-headers";

const jiti = createJiti(import.meta.url);

export const withMarkdoc = markdocConfig()({
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
});

export type { NextConfig };

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti.import("@repo/env");

export const config: NextConfig = {
	// PERF: Optimize barrel file imports (15-70% faster dev boot, 28% faster builds)
	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"date-fns",
			"@repo/design-system",
		],
  },
  logging: {
    browserToTerminal: true,
  },

	headers() {
		return [
			{
				headers: createSecureHeaders({
					// HSTS Preload: https://hstspreload.org/
					forceHTTPSRedirect: [
						true,
						{ includeSubDomains: true, maxAge: 63_072_000, preload: true },
					],
				}),
				source: "/(.*)",
			},
		];
	},

	images: {
		formats: ["image/avif", "image/webp"],
	},

	// Tell Next.js where the monorepo root is so standalone output preserves
	// the correct directory structure (apps/app/server.js).
output: "standalone",
outputFileTracingRoot: resolve(import.meta.dirname, "../../"),

	// Skip type-checking during Docker builds — this runs in CI instead.
	// Prevents OOM kills on memory-constrained build servers.
	typescript: {
		ignoreBuildErrors: !!process.env.SKIP_ENV_VALIDATION,
	},
};

const nextConfig: NextConfig = { ...config };

export default nextConfig;
