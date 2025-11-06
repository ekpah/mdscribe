import { authed } from '@/orpc';

// Guideline routes
const getFavoriteGuidelinesHandler = authed.handler(async ({ context }) => {
  const favoriteGuidelines = await context.db.guideline.findMany({
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

  return favoriteGuidelines;
});

const getAuthoredGuidelinesHandler = authed.handler(async ({ context }) => {
  const userGuidelines = await context.db.guideline.findMany({
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

  return userGuidelines;
});

export const guidelinesHandler = {
  favourites: getFavoriteGuidelinesHandler,
  authored: getAuthoredGuidelinesHandler,
};
