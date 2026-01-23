import {
	QueryClient,
	defaultShouldDehydrateQuery,
	isServer,
} from "@tanstack/react-query";

/**
 * TanStack Query client factory with optimized defaults for Next.js App Router
 *
 * Key configurations:
 * - staleTime: 60s - prevents immediate refetch after SSR hydration
 * - gcTime: 5 minutes - keeps unused queries in cache for quick re-access
 * - Pending query dehydration - enables streaming SSR (queries start on server, complete on client)
 */
function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, set staleTime > 0 to avoid refetching immediately on the client
				staleTime: 60 * 1000, // 1 minute
				// Garbage collection time - how long to keep unused queries in cache
				gcTime: 5 * 60 * 1000, // 5 minutes
				// Retry failed queries up to 3 times with exponential backoff
				retry: 3,
				// Don't refetch on window focus in server context
				refetchOnWindowFocus: !isServer,
			},
			dehydrate: {
				// Include pending queries in dehydration for streaming SSR
				// This allows queries to start on the server and complete on the client
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
				// Don't redact errors - let Next.js handle error boundaries
				shouldRedactErrors: () => false,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

/**
 * Get a QueryClient instance
 *
 * - Server: Always creates a new client (prevents data leakage between requests)
 * - Browser: Reuses a singleton client (preserves cache across navigations)
 *
 * This pattern is recommended by TanStack Query for Next.js App Router
 */
export function getQueryClient() {
	if (isServer) {
		// Server: always make a new query client to prevent state sharing between requests
		return makeQueryClient();
	}
	// Browser: make a new query client if we don't already have one
	// This prevents re-creating the client if React suspends during initial render
	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();
	}
	return browserQueryClient;
}
