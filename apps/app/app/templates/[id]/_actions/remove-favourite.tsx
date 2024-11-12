'use server';
import { auth } from '@/auth';
import type { Prisma } from '@repo/database';
import { database } from '@repo/database';

export default async function removeFavourite({
  template,
}: {
  template: Prisma.TemplateGetPayload<{
    include: { favouriteOf: true };
  }>;
}) {
  'use server';
  const session = await auth();
  console.log(template);
  const res = await database.template.update({
    where: {
      id: template.id,
    },
    data: {
      favouriteOf: {
        disconnect: { id: session?.user?.id },
      },
    },
  });
  return res;
}
