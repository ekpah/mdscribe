import { authed } from '@/orpc';

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
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return favoriteTemplates;
});

const getAuthoredTemplatesHandler = authed.handler(async ({ context }) => {
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

const getRecentActivityHandler = authed.handler(async ({ context }) => {
  const recentEvents = await context.db.usageEvent.findMany({
    where: {
      userId: context.session.user.id,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 5,
  });

  return recentEvents;
});

export const templatesHandler = {
  favourites: getFavoriteTemplatesHandler,
  authored: getAuthoredTemplatesHandler,
  recentActivity: getRecentActivityHandler,
};
