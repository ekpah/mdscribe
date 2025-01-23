'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export default async function addFavourite({
  templateId,
}: {
  templateId: string;
}) {
  'use server';
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const res = await database.template.update({
    where: {
      id: templateId,
    },
    data: {
      favouriteOf: {
        connect: { id: session?.user?.id },
      },
    },
  });
  revalidatePath('/templates/');
  return res;
}
