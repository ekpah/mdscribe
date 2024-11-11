'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';

export default async function addFavourite(template) {
  'use server';
  const session = await auth();
  const res = await database.template.update({
    where: {
      id: template.id,
    },
    data: {
      favouriteOf: {
        connect: { id: session?.user?.id },
      },
    },
  });
  return res;
}
