import { type } from '@orpc/server';
import type { Prisma } from '@repo/database';
import z from 'zod';
import { pub } from '@/orpc';

type Guideline = Prisma.GuidelineGetPayload<{
    include: {
        favouriteOf: true;
        author: true;
    };
}>;

const getGuidelineInput = z.object({
    id: z.string(),
});

const getGuidelineHandler = pub
    .input(getGuidelineInput)
    .output(type<Guideline | null>())
    .handler(async ({ context, input }) => {
        const guideline = await context.db.guideline.findUnique({
            where: {
                id: input.id,
            },
            include: {
                favouriteOf: true,
                author: true,
            },
        });
        return guideline ?? null;
    });

export const guidelinesHandler = {
    get: getGuidelineHandler,
};
