import { ORPCError, os } from '@orpc/server';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import type { Session } from '@/lib/auth-types';

export const requiredAuthMiddleware = os
    .$context<{ session?: Session }>()
    .middleware(async ({ context, next }) => {
        /**
         * Why we should ?? here?
         * Because it can avoid `getSession` being called when unnecessary.
         * {@link https://orpc.unnoq.com/docs/best-practices/dedupe-middleware}
         */
        const session = context.session ?? await getSession()

        if (!session?.user) {
            throw new ORPCError('UNAUTHORIZED')
        }

        return next({
            context: { session },
        })
    })

async function getSession() {

    const headerList = await headers();

    const session = await auth.api.getSession({
        headers: headerList
    });
    return session;
}