import NextAuth from "next-auth";
import authConfig from "./auth.config";

// Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export const runtime = "experimental-edge";

export const { auth: middleware } = NextAuth(authConfig);
