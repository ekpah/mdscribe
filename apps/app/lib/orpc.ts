import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { env } from '@repo/env';
import type { RouterClient } from '@orpc/server';
import type { router } from '@/orpc/router';

const link = new RPCLink({
    headers: async () => {
        if (typeof window !== 'undefined') {
            return {};
        }

        const { headers } = await import('next/headers');
        return Object.fromEntries(await headers());
    },
    url: `${typeof window !== 'undefined' ? window.location.origin : env.NEXT_PUBLIC_BASE_URL}/api/rpc`,
});

/**
 * Fallback to client-side client if server-side client is not available.
 */
const client: RouterClient<typeof router> =
    globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);

declare global {
    var $client: RouterClient<typeof router> | undefined;
}
