import { stripe } from "@better-auth/stripe";
import {
	account,
	database,
	eq,
	session,
	subscription,
	user,
	verification,
} from "@repo/database";
import { sendEmail } from "@repo/email";
import { EmailChangeTemplate } from "@repo/email/templates/change-email";
import { ResetPasswordTemplate } from "@repo/email/templates/reset-password";
import { EmailVerificationTemplate } from "@repo/email/templates/verify";
import { env } from "@repo/env";
import { betterAuth, type User } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import Stripe from "stripe";

// initialize stripe client
if (!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)) {
	throw new Error("STRIPE_SECRET_KEY is not set");
}
const stripeClient = new Stripe(env.STRIPE_SECRET_KEY as string);

export const auth = betterAuth({
	baseURL: env.NEXT_PUBLIC_BASE_URL as string,
	// sets the Better-Auth database adapter to Drizzle with PostgreSQL provider
	database: drizzleAdapter(database, {
		provider: "pg",
	}),
	// enables cookie caching for better-auth sessions
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // Cache duration in seconds
		},
	},
	// defines a user object
	user: {
		// defines how a user can change their email
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async ({ user, newEmail, url }) => {
				await sendEmail({
					from: "noreply@mdscribe.de",
					to: user.email, // verification email must be sent to the current user email to approve the change
					subject: "Genehmige E-Mail-Änderung",
					template: EmailChangeTemplate({ url, newEmail }),
				});
			},
			callbackURL: "/dashboard", // The redirect URL after verification
		},
		additionalFields: {
			stripeCustomerId: {
				type: "string",
				required: false,
			},
		},
	},
	// enables login with the email and password flow
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user: resetUser, url }) => {
			if (env.NODE_ENV === "development") {
				console.log({
					to: resetUser.email,
					subject: "Setze dein Passwort zurück",
					text: `Klicke auf den Link, um dein Passwort zurückzusetzen: ${url}`,
				});
			} else {
				void sendEmail({
					from: "noreply@mdscribe.de",
					to: resetUser.email,
					subject: "Setze dein Passwort zurück",
					template: ResetPasswordTemplate({ url }),
				});
			}
		},
		onPasswordReset: async ({ user: resetUser }) => {
			// User has proven email access by clicking the reset link,
			// so mark their email as verified
			await database
				.update(user)
				.set({ emailVerified: true })
				.where(eq(user.id, resetUser.id));
		},
	},
	// define email verification functions
	emailVerification: {
		autoSignInAfterVerification: true,
		callbackURL: "/email-verified", // The redirect URL after verification
		expiresIn: 3600, // 1 hour
		sendOnSignUp: true,
		sendOnSignIn: true,
		sendVerificationEmail: async ({ user, url, token }) => {
			if (env.NODE_ENV === "development") {
				await console.log({
					to: user.email,
					subject: "Verify your email address",
					text: `Click the link to verify your email: ${url}`,
				});
			} else {
				await sendEmail({
					from: "noreply@mdscribe.de",
					to: user.email,
					subject: "Verify your email address",
					template: EmailVerificationTemplate({ url }),
				});
			}
		},
	},
	// define plugins for better-auth
	plugins: [
		// stripe plugin for subscription management
		stripe({
			stripeClient,
			stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET as string,
			createCustomerOnSignUp: true,
			subscription: {
				enabled: true,

				plans: [
					{
						name: "plus", // the name of the plan, it'll be automatically lower cased when stored in the database
						priceId: env.STRIPE_PLUS_PRICE_ID as string,
						annualDiscountPriceId: env.STRIPE_PLUS_PRICE_ID_ANNUAL as string,
						limits: {
							ai_scribe_generations: 500,
						},
					},
				],
				// ... other options
			},
			getCheckoutSessionParams: () => {
				return {
					params: {
						allow_promotion_codes: true,
					},
				};
			},
		}),
	],
});
