import { stripeClient } from '@better-auth/stripe/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { auth } from '../auth.ts';

export const authClient = createAuthClient({
  baseURL: process.env.BASE_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    // stripe plugin for subscription management
    stripeClient({
      subscription: true, //if you want to enable subscription management
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
