import { stripe } from "@better-auth/stripe";
import { eq, user as userTable } from "@repo/database";
import { database } from "@repo/database/client";
import { sendEmail } from "@repo/email";
import { EmailChangeTemplate } from "@repo/email/templates/change-email";
import { ResetPasswordTemplate } from "@repo/email/templates/reset-password";
import { EmailVerificationTemplate } from "@repo/email/templates/verify";
import { env } from "@repo/env";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Stripe as StripeClient } from "stripe";

// Initialize stripe client (use placeholder during Docker builds where env vars aren't available)
const isBuildTime = !!process.env.SKIP_ENV_VALIDATION;
if (!isBuildTime && !(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)) {
	throw new Error("STRIPE_SECRET_KEY is not set");
}
const stripeClient = new StripeClient(
	(env.STRIPE_SECRET_KEY as string) || "sk_placeholder",
);

export const auth = betterAuth({
	baseURL: env.NEXT_PUBLIC_BASE_URL as string,
	database: drizzleAdapter(database, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
		onPasswordReset: async ({ user: resetUser }) => {
			await database
				.update(userTable)
				.set({ emailVerified: true })
				.where(eq(userTable.id, resetUser.id));
		},
		requireEmailVerification: true,
		sendResetPassword: async ({ user: resetUser, url }) => {
			if (env.NODE_ENV === "development") {
				console.log({
					subject: "Setze dein Passwort zurück",
					text: `Klicke auf den Link, um dein Passwort zurückzusetzen: ${url}`,
					to: resetUser.email,
				});
				return;
			}
			await sendEmail({
				from: "noreply@mdscribe.de",
				subject: "Setze dein Passwort zurück",
				template: ResetPasswordTemplate({ url }),
				to: resetUser.email,
			});
		},
	},
	emailVerification: {
		autoSignInAfterVerification: true,
		callbackURL: "/email-verified",
		expiresIn: 3600,
		sendOnSignIn: true,
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user: authUser, url, token: _token }) => {
			if (env.NODE_ENV === "development") {
				await console.log({
					subject: "Verify your email address",
					text: `Click the link to verify your email: ${url}`,
					to: authUser.email,
				});
				return;
			}
			await sendEmail({
				from: "noreply@mdscribe.de",
				subject: "Verify your email address",
				template: EmailVerificationTemplate({ url }),
				to: authUser.email,
			});
		},
	},
	plugins: [
		stripe({
			createCustomerOnSignUp: true,
			getCheckoutSessionParams: () => ({
				params: {
					allow_promotion_codes: true,
				},
			}),
			stripeClient,
			stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET as string,
			subscription: {
				enabled: true as const,
				plans: [
					{
						annualDiscountPriceId: env.STRIPE_PLUS_PRICE_ID_ANNUAL as string,
						limits: {
							ai_scribe_generations: 500,
						},
						name: "plus",
						priceId: env.STRIPE_PLUS_PRICE_ID as string,
					},
				],
			},
		}),
	],
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	user: {
		additionalFields: {
			stripeCustomerId: {
				required: false,
				type: "string",
			},
		},
		changeEmail: {
			callbackURL: "/dashboard",
			enabled: true,
			sendChangeEmailVerification: async (args: {
				user: { email: string };
				newEmail: string;
				url: string;
			}) => {
				const { user: authUser, newEmail, url } = args;
				await sendEmail({
					from: "noreply@mdscribe.de",
					subject: "Genehmige E-Mail-Änderung",
					template: EmailChangeTemplate({ newEmail, url }),
					to: authUser.email,
				});
			},
		},
	},
});
