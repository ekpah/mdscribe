import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth"; // path to your auth file

export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler(auth);
