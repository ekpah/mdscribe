import "server-only";
import { env } from "@/env";

const getStripeConfig = () => {
	if (!env.STRIPE_SECRET_KEY) {
		return null;
	}

	if (!(env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PLUS_PRICE_ID && env.STRIPE_PLUS_PRICE_ID_ANNUAL)) {
		throw new Error(
			"STRIPE_WEBHOOK_SECRET, STRIPE_PLUS_PRICE_ID, and STRIPE_PLUS_PRICE_ID_ANNUAL are required when STRIPE_SECRET_KEY is set",
		);
	}

	return {
		annualPriceId: env.STRIPE_PLUS_PRICE_ID_ANNUAL,
		priceId: env.STRIPE_PLUS_PRICE_ID,
		secretKey: env.STRIPE_SECRET_KEY,
		webhookSecret: env.STRIPE_WEBHOOK_SECRET,
	};
};

export const stripeConfig = getStripeConfig();
export const subscriptionsEnabled = stripeConfig !== null;
