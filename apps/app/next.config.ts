import markdocConfig from "@markdoc/next.js";
import { createJiti } from "jiti";
import type { NextConfig } from "next";
import { createSecureHeaders } from "next-secure-headers";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const jiti = createJiti(import.meta.url);

export const withMarkdoc = markdocConfig()({
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdoc"],
});

export type { NextConfig };

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti.import("@repo/env");

export const config: NextConfig = {
	output: "standalone",

	// Tell Next.js where the monorepo root is so standalone output preserves
	// the correct directory structure (apps/app/server.js).
	outputFileTracingRoot: resolve(
		dirname(fileURLToPath(import.meta.url)),
		"../../",
	),

	// Skip type-checking during Docker builds — this runs in CI instead.
	// Prevents OOM kills on memory-constrained build servers.
	typescript: {
		ignoreBuildErrors: !!process.env.SKIP_ENV_VALIDATION,
	},

	images: {
		formats: ["image/avif", "image/webp"],
	},

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
};

let nextConfig: NextConfig = { ...config };

export default nextConfig;
