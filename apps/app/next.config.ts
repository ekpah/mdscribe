import { resolve } from "node:path";

import { createJiti } from "jiti";
import type { NextConfig } from "next";
import { createSecureHeaders } from "next-secure-headers";

const jiti = createJiti(import.meta.url);

export type { NextConfig };

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti.import("@repo/env");

export const config: NextConfig = {
	// PERF: Optimize barrel-file imports (15-70% faster dev boot, 28% faster builds).
	// Next.js already optimizes a built-in list (lucide-react, recharts, date-fns, …),
	// so only list barrels that aren't covered by that default.
	//
	// NOTE on zod's ~160KB i18n locale tables: zod 4.x re-exports the whole locale
	// barrel (`export * as locales from "../locales/index.js"`), which Turbopack
	// can't tree-shake even via optimizePackageImports (verified by build). We strip
	// those ~30 unused locale files at the source via patches/zod@4.3.6.patch
	// (patchedDependencies in the root package.json) — default English errors are
	// unaffected (they use a direct `import en from "../locales/en.js"`).
	experimental: {
		optimizePackageImports: [
			"@repo/design-system",
			"radix-ui",
			"react-aria-components",
		],
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

	logging: {
		browserToTerminal: true,
	},

	// Tell Next.js where the monorepo root is so standalone output preserves
	// the correct directory structure (apps/app/server.js).
	output: "standalone",

	// Prisma is pulled in only as an unused optional peer of better-auth's
	// prisma adapter (we use the Drizzle adapter). Nothing imports it, so it is
	// already traced out of the standalone build — exclude it explicitly so the
	// ~75MB can never sneak into the production image.
	outputFileTracingExcludes: {
		"*": ["**/node_modules/@prisma/**", "**/node_modules/prisma/**"],
	},
	outputFileTracingRoot: resolve(import.meta.dirname, "../../"),

	// Skip type-checking during Docker builds — this runs in CI instead.
	// Prevents OOM kills on memory-constrained build servers.
	typescript: {
		ignoreBuildErrors: !!process.env.SKIP_ENV_VALIDATION,
	},
};

const nextConfig: NextConfig = { ...config };

export default nextConfig;
