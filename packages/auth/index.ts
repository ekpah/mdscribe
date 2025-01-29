import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { ResetPasswordTemplate } from '@repo/email/templates/reset-password';
import { EmailVerificationTemplate } from '@repo/email/templates/verify';
import { betterAuth } from 'better-auth';

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
  // enables login with the email and password flow
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      if (process.env.NODE_ENV === 'development') {
        await console.log({
          to: user.email,
          subject: 'Reset your password',
          text: `Click the link to reset your password: ${url}`,
        });
      } else {
        await sendEmail({
          from: 'noreply@mdscribe.de',
          to: user.email,
          subject: 'Reset your password',
          template: ResetPasswordTemplate({ url }),
        });
      }
    },
  },
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
});
