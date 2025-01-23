'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { headers } from 'next/headers';

export default async function removeFavourite({
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
        disconnect: { id: session?.user?.id },
      },
    },
  });
  return res;
}
