import type { NextAuthConfig } from "next-auth";
import Postmark from "next-auth/providers/postmark";
// Notice this is only an object, not a full Auth.js instance
export default {
  providers: [
    Postmark({
      from: "no-reply@mdscribe.de",
    }),
  ],
} satisfies NextAuthConfig;
