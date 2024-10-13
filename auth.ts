import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";

import NextAuth from "next-auth";
import Postmark from "next-auth/providers/postmark";

// *DO NOT* create a `Pool` here, outside the request handler.
// Neon's Postgres cannot keep a pool alive between requests.

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  // Create a `Pool` inside the request handler.
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  return {
    adapter: PostgresAdapter(pool),
    providers: [
      Postmark({
        from: "no-reply@mdscribe.de",
      }),
    ],
  };
});
