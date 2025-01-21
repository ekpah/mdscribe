import { database } from '@repo/database';
import { sendEmail } from '@repo/email';
import { ResetPasswordTemplate } from '@repo/email/templates/reset-password';
import { EmailVerificationTemplate } from '@repo/email/templates/verify';
import { betterAuth } from 'better-auth';

import { prismaAdapter } from 'better-auth/adapters/prisma';
export const auth = betterAuth({
  database: prismaAdapter(database, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
  }),
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
