import { ORPCError } from '@orpc/client';
import { os } from '@orpc/server';
import { auth } from '@/auth';

export const authMiddleware = os
    .$context<{ headers: Headers }>()
    .middleware(async ({ context, next }) => {
        // Execute logic before the handler

        const session = await auth.api.getSession({
            headers: context.headers,
        });

        if (!session) {
            throw new ORPCError('UNAUTHORIZED', {
                message: 'You are not authorized to access this resource',
            });
        }

        return next({
            context: {
                session,
            },
        });
    });
