'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export default async function addFavourite({
  guidelineId,
}: {
  guidelineId: string;
}) {
  'use server';
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const res = await database.guideline.update({
    where: {
      id: guidelineId,
    },
    data: {
      favouriteOf: {
        connect: { id: session?.user?.id },
      },
    },
  });
  revalidatePath('/guidelines/');
  return res;
}
