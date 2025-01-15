import { Pool } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.POSTGRES_URL }),
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
  // Other configs
  session: {
    fields: {
      expiresAt: 'expires', // e.g., "expires_at" or your existing field name
      token: 'sessionToken', // e.g., "session_token" or your existing field name
    },
  },
  accounts: {
    fields: {
      accountId: 'providerAccountId',
      refreshToken: 'refresh_token',
      accessToken: 'access_token',
      accessTokenExpiresAt: 'access_token_expires',
      idToken: 'id_token',
    },
  },
});
