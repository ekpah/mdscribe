import { PrismaAdapter } from "@auth/prisma-adapter";
import { Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import NextAuth from "next-auth";

const neon = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
});
const adapter = new PrismaNeon(neon);
const prisma = new PrismaClient({ adapter });

import Postmark from "next-auth/providers/postmark";
// *DO NOT* create a `Pool` here, outside the request handler.
// Neon's Postgres cannot keep a pool alive between requests.

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  // Create a `Pool` inside the request handler.

  return {
    adapter: PrismaAdapter(prisma),
    providers: [
      Postmark({
        from: "no-reply@we-mail.de",
      }),
    ],
  };
});
