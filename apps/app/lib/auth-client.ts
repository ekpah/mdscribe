import { stripeClient } from "@better-auth/stripe/client";
import { env } from "@repo/env";
import { useQuery } from "@tanstack/react-query";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "../auth.ts";
import type { Session } from "./auth-types";
import {
	normalizeSession,
	sessionQueryKey,
	sessionQueryStaleTime,
} from "./session-query";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_BASE_URL as string,
	plugins: [
		inferAdditionalFields<typeof auth>(),
		// stripe plugin for subscription management
		stripeClient({
			subscription: true, // if you want to enable subscription management
		}),
	],
});

const fetchSession = async (): Promise<Session | null> => {
	const result = await authClient.getSession();
	if (result.error) {
		throw new Error(result.error.message || "Failed to load session");
	}
	return normalizeSession(result.data);
};

export const useSession = () =>
	useQuery({
		queryKey: sessionQueryKey,
		queryFn: fetchSession,
		staleTime: sessionQueryStaleTime,
	});

export const { signIn, signUp } = authClient;
