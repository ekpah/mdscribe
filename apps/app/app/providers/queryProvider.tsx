// In Next.js, this file would be called: app/providers.tsx
'use client';

import {
    isServer,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { TRPCProvider } from '@/lib/trpc';
// Since QueryClientProvider relies on useContext under the hood, we have to put 'use client' on top
import type { AppRouter } from '@/trpc/routers/_app';

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // With SSR, we usually want to set some default staleTime
                // above 0 to avoid refetching immediately on the client
                staleTime: 60 * 1000,
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
    if (isServer) {
        // Server: always make a new query client
        return makeQueryClient();
    }
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
}


function getUrl() {
    const base = (() => {
        if (typeof window !== 'undefined') { return ''; }
        if (process.env.VERCEL_URL) { return `https://${process.env.VERCEL_URL}`; }
        return 'http://localhost:3000';
    })();
    return `${base}/api/trpc`;
}


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
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [
                httpBatchLink({
                    url: getUrl(),
                }),
            ],
        })
    );
    return (
        <QueryClientProvider client={queryClient}>
            <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
                {children}
            </TRPCProvider>
        </QueryClientProvider>
    );
}
