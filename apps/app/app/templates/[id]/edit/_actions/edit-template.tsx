'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { headers } from 'next/headers';

export default async function editTemplate(formData: FormData) {
  'use server';
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // handle submitting the template to save it to prisma (Neon-Postgres)
  const rawFormData = {
    id: formData.get('id') as string,
    category: formData.get('category') as string,
    name: formData.get('name') as string,
    content: formData.get('content') as string,
    authorId: formData.get('authorId') as string,
  };

  if (rawFormData.authorId !== session?.user?.id) {
    throw new Error('Permission denied');
  }
  const res = await database.template.update({
    where: {
      id: rawFormData.id,
      authorId: session.user.id,
    },
    data: {
      category: rawFormData.category,
      title: rawFormData.name,
      content: rawFormData.content,
      author: {
        connect: {
          id: session?.user?.id as string, // Assuming session.user.id exists and is the correct user ID
        },
      },
    },
  });
}
