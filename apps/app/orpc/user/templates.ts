import { authed, pub } from '@/orpc';


// Template routes
const getFavoriteTemplatesHandler = authed.handler(async ({ context }) => {
    const favoriteTemplates = await context.db.template.findMany({
        where: {
            favouriteOf: {
                some: {
                    id: context.session.user.id,
                },
            },
        },
        include: {
            _count: {
                select: { favouriteOf: true },
            },
        },
        take: 5,
        orderBy: {
            updatedAt: 'desc',
        },
    });

    return favoriteTemplates;
});

const getUserTemplatesHandler = authed.handler(async ({ context }) => {
    const userTemplates = await context.db.template.findMany({
        where: {
            authorId: context.session.user.id,
        },
        include: {
            _count: {
                select: { favouriteOf: true },
            },
        },
        take: 3,
        orderBy: {
            updatedAt: 'desc',
        },
    });

    return userTemplates;
});

export const templatesHandler = {
    favourites: getFavoriteTemplatesHandler,
    all: getUserTemplatesHandler,
};
