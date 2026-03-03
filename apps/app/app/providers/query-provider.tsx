'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/get-query-client';

/**
 * TanStack Query Provider for Next.js App Router
 *
 * Uses the shared getQueryClient utility which:
 * - Creates a new QueryClient for each server request (prevents data leakage)
 * - Reuses a singleton client in the browser (preserves cache across navigations)
 * - Configures optimized defaults for SSR (staleTime, gcTime, pending dehydration)
 */
export default function QueryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // NOTE: Avoid useState when initializing the query client if you don't
    //       have a suspense boundary between this and the code that may
    //       suspend because React will throw away the client on the initial
    //       render if it suspends and there is no boundary
    const queryClient = getQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
