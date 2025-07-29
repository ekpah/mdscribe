import { type } from '@orpc/server';
import type { Prisma } from '@repo/database';
import z from 'zod';
import { pub } from '@/orpc';

type Template = Prisma.TemplateGetPayload<{
    include: {
        favouriteOf: true;
        author: true;
    };
}>;

const getTemplateInput = z.object({
    id: z.string(),
});

const getTemplateHandler = pub
    .input(getTemplateInput)
    .output(type<Template | null>())
    .handler(async ({ context, input }) => {
        const template = await context.db.template.findUnique({
            where: {
                id: input.id,
            },
            include: {
                favouriteOf: true,
                author: true,
            },
        });
        return template ?? null;
    });

export const templatesHandler = {
    get: getTemplateHandler,
};
