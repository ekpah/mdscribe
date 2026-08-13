import { resolve } from "node:path";

import { createJiti } from "jiti";
import type { NextConfig } from "next";
import { createSecureHeaders } from "next-secure-headers";

const jiti = createJiti(import.meta.url);

export type { NextConfig };

// Import env here to validate during build. Using jiti@^1 we can import .ts files :)
jiti.import("./env.ts");

const getOrbPortalHostname = (): string | undefined => {
	if (
		process.env.NODE_ENV !== "development" ||
		process.env.MDSCRIBE_ORB_PREVIEW !== "1" ||
		!process.env.PUBLIC_URL
	) {
		return undefined;
	}

	try {
		const url = new URL(process.env.PUBLIC_URL);
		if (
			url.protocol !== "https:" ||
			!url.hostname.endsWith(".onamp.dev") ||
			url.username ||
			url.password ||
			url.pathname !== "/" ||
			url.search ||
			url.hash
		) {
			return undefined;
		}
		return url.hostname;
	} catch {
		return undefined;
	}
};

const orbPortalHostname = getOrbPortalHostname();

export const config: NextConfig = {
	allowedDevOrigins: orbPortalHostname ? [orbPortalHostname] : undefined,
	devIndicators: orbPortalHostname ? false : undefined,

	// PERF: Optimize barrel-file imports (15-70% faster dev boot, 28% faster builds).
	// Next.js already optimizes a built-in list (lucide-react, recharts, date-fns, …),
	// so only list barrels that aren't covered by that default.
	experimental: {
		optimizePackageImports: [
			"@repo/design-system",
			"@base-ui/react",
			"react-aria-components",
		],
	},

	headers() {
		const isPortalPreview = !!orbPortalHostname;
		return [
			{
				headers: createSecureHeaders({
					contentSecurityPolicy: isPortalPreview
						? {
								directives: {
									frameAncestors: ["'self'", "https://ampcode.com"],
								},
							}
						: false,
					// HSTS Preload: https://hstspreload.org/
					forceHTTPSRedirect: [
						true,
						{ includeSubDomains: true, maxAge: 63_072_000, preload: true },
					],
					frameGuard: isPortalPreview ? false : "deny",
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
