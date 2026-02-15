import type { Session } from "@/lib/auth-types";

export const sessionQueryKey = ["auth", "session"] as const;

// Keep session data warm long enough to avoid repeated fetches during normal navigation.
export const sessionQueryStaleTime = 5 * 60 * 1000;

export const normalizeSession = (
	session: Session | null | undefined,
): Session | null => session ?? null;
