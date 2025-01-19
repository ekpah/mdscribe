import { database } from '@repo/database';
import { betterAuth } from 'better-auth';

import { prismaAdapter } from 'better-auth/adapters/prisma';
export const auth = betterAuth({
  database: prismaAdapter(database, {
    provider: 'postgresql', // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await console.log({
        to: user.email,
        subject: 'Reset your password',
        text: `Click the link to reset your password: ${url}`,
      });
    },
  },
});
