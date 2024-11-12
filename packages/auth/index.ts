import PostgresAdapter from '@auth/pg-adapter';
import { Pool } from '@neondatabase/serverless';
import NextAuth from 'next-auth';
import Postmark from 'next-auth/providers/postmark';

// *DO NOT* create a `Pool` here, outside the request handler.
// Neon's Postgres cannot keep a pool alive between requests.

export const { handlers, auth, signIn, signOut }: any = NextAuth(() => {
  // Create a `Pool` inside the request handler.
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  return {
    adapter: PostgresAdapter(pool),
    providers: [
      Postmark({
        from: 'no-reply@mdscribe.de',
      }),
    ],
    session: {
      strategy: 'jwt',
    },
    //  By default, the `id` property does not exist on `token` or `session`. See the [TypeScript](https://authjs.dev/getting-started/typescript) on how to add it.
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          // User is available during sign-in
          token.id = user.id;
        }
        return token;
      },
      session({ session, token }) {
        session.user.id = token.id as string;
        return session;
      },
    },
  };
});
