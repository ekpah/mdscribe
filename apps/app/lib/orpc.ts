import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import type { router } from '@/orpc/router';


const link = new RPCLink({
    url: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/rpc`,
    headers: async () => {
        if (typeof window !== 'undefined') {
            return {}
        }

        const { headers } = await import('next/headers')
        return Object.fromEntries(await headers())
    },
});

/**
 * Fallback to client-side client if server-side client is not available.
 */
const client: RouterClient<typeof router> =
    globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);


declare global {
    var $client: RouterClient<typeof router> | undefined
}
