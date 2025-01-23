'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export default async function createTemplate(formData: FormData) {
  'use server';
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('User not found');
  }

  // handle submitting the template to save it to prisma (Neon-Postgres)
  const rawFormData = {
    category: formData.get('category') as string,
    name: formData.get('name') as string,
    content: formData.get('content') as string,
    id: formData.get('id') as string,
  };

  if (rawFormData.id) {
    throw new Error('Template already exists');
  }
  const res = await database.template.create({
    data: {
      category: rawFormData.category,
      title: rawFormData.name,
      content: rawFormData.content,
      author: {
        connect: {
          id: session?.user?.id as string,
        },
      },
    },
  });

  revalidatePath('/templates/');
  return res;
}
