import { stripe } from '@better-auth/stripe';
import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { EmailChangeTemplate } from '@repo/email/templates/change-email';
import { ResetPasswordTemplate } from '@repo/email/templates/reset-password';
import { EmailVerificationTemplate } from '@repo/email/templates/verify';
import { betterAuth } from 'better-auth';
import Stripe from 'stripe';

// initialize stripe client
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '');

import { prismaAdapter } from 'better-auth/adapters/prisma';
export const auth = betterAuth({
  // sets the Better-Auth database adapter to Prisma with the PostgreSQL provider
  database: prismaAdapter(database, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
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
      sendChangeEmailVerification: async (
        { user, newEmail, url, token },
        request
      ) => {
        await sendEmail({
          from: 'noreply@mdscribe.de',
          to: user.email, // verification email must be sent to the current user email to approve the change
          subject: 'Genehmige E-Mail-Änderung',
          template: EmailChangeTemplate({ url, newEmail }),
        });
      },
    },
  },
  // enables login with the email and password flow
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      if (process.env.NODE_ENV === 'development') {
        await console.log({
          to: user.email,
          subject: 'Setze dein Passwort zurück',
          text: `Klicke auf den Link, um dein Passwort zurückzusetzen: ${url}`,
        });
      } else {
        await sendEmail({
          from: 'noreply@mdscribe.de',
          to: user.email,
          subject: 'Setze dein Passwort zurück',
          template: ResetPasswordTemplate({ url }),
        });
      }
    },
  },
  // define email verification functions
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      if (process.env.NODE_ENV === 'development') {
        await console.log({
          to: user.email,
          subject: 'Verify your email address',
          text: `Click the link to verify your email: ${url}`,
        });
      } else {
        await sendEmail({
          from: 'noreply@mdscribe.de',
          to: user.email,
          subject: 'Verify your email address',
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
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      createCustomerOnSignUp: true,
    }),
  ],
});
