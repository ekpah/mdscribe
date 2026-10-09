import { createAuthClient } from "better-auth/react";

import { env } from "@/env";

// Load and initialize Stripe only when an enabled billing action is invoked.
export const getBillingClient = async () => {
	const { stripeClient } = await import("@better-auth/stripe/client");
	return createAuthClient({
		baseURL: env.NEXT_PUBLIC_BASE_URL as string,
		plugins: [stripeClient({ subscription: true })],
	});
};
