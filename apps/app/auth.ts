import { stripe } from "@better-auth/stripe";
import { eq, user as userTable } from "@repo/database";
import { database } from "@repo/database/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { username } from "better-auth/plugins";
import { Stripe as StripeClient } from "stripe";

import { env } from "@/env";
import { USER_MESSAGES } from "@/lib/user-messages";

// Usernames feed per-author slug routes, so they must be URL-safe and must not
// collide with reserved path segments.
const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
const RESERVED_USERNAMES = new Set([
	"admin",
	"aiscribe",
	"api",
	"app",
	"auth",
	"dashboard",
	"documents",
	"help",
	"mdscribe",
	"profile",
	"root",
	"settings",
	"support",
	"system",
	"templates",
	"u",
	"www",
]);

const isValidUsername = (value: string): boolean =>
	USERNAME_PATTERN.test(value) && !RESERVED_USERNAMES.has(value.toLowerCase());

// Initialize stripe client (use placeholder during Docker builds where env vars aren't available)
const isBuildTime = !!process.env.SKIP_ENV_VALIDATION;
if (!isBuildTime && !(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)) {
	throw new Error("STRIPE_SECRET_KEY is not set");
}
const stripeClient = new StripeClient((env.STRIPE_SECRET_KEY as string) || "sk_placeholder");

const authBaseUrl = new URL(env.NEXT_PUBLIC_BASE_URL as string);
const isOrbPreview =
	process.env.NODE_ENV === "development" &&
	process.env.MDSCRIBE_ORB_PREVIEW === "1" &&
	authBaseUrl.protocol === "https:" &&
	authBaseUrl.hostname.endsWith(".onamp.dev") &&
	authBaseUrl.pathname === "/" &&
	!authBaseUrl.username &&
	!authBaseUrl.password &&
	!authBaseUrl.search &&
	!authBaseUrl.hash;

const userNameLengthHook = {
	before: (authUser: Record<string, unknown>) => {
		if (typeof authUser.name === "string" && authUser.name.length > 30) {
			throw new APIError("BAD_REQUEST", {
				message: USER_MESSAGES.userNameMaxLength,
			});
		}

		return Promise.resolve({ data: authUser });
	},
};

export const auth = betterAuth({
	advanced: isOrbPreview
		? {
				defaultCookieAttributes: {
					partitioned: true,
					sameSite: "none",
					secure: true,
				},
			}
		: undefined,
	baseURL: env.NEXT_PUBLIC_BASE_URL as string,
	database: drizzleAdapter(database, {
		provider: "pg",
	}),
	databaseHooks: {
		user: {
			create: userNameLengthHook,
			update: userNameLengthHook,
		},
	},
	// We never check username availability client-side, so disable the endpoint
	// to avoid username enumeration.
	disabledPaths: ["/is-username-available"],
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
			const [{ sendEmail }, { ResetPasswordTemplate }] = await Promise.all([
				import("@repo/email"),
				import("@repo/email/templates/reset-password"),
			]);
			await sendEmail({
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
			const [{ sendEmail }, { EmailVerificationTemplate }] = await Promise.all([
				import("@repo/email"),
				import("@repo/email/templates/verify"),
			]);
			await sendEmail({
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
		username({
			minUsernameLength: 3,
			usernameValidator: isValidUsername,
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
				const [{ sendEmail }, { EmailChangeTemplate }] = await Promise.all([
					import("@repo/email"),
					import("@repo/email/templates/change-email"),
				]);
				await sendEmail({
					subject: "Genehmige E-Mail-Änderung",
					template: EmailChangeTemplate({ newEmail, url }),
					to: authUser.email,
				});
			},
		},
	},
});
