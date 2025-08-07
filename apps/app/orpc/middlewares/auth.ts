import { ORPCError, os } from '@orpc/server';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import type { Session } from '@/lib/auth-types';

export const requiredAuthMiddleware = os
    .$context<{ session?: Session }>()
    .middleware(async ({ context, next }) => {
        const session = context.session ?? (await getSession());
        if (!session?.user) {
            throw new ORPCError('UNAUTHORIZED');
        }

        return next({
            context: { session },
        });
    });

async function getSession() {
    const headerList = await headers();

    const session = await auth.api.getSession({
        headers: headerList,
    });
    return session;
}
