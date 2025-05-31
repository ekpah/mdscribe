'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import pgvector from 'pgvector';
import { generateEmbeddings } from './embed-template';

export default async function createTemplate(formData: FormData): Promise<{
  id: string;
  title: string;
  category: string;
  content: string;
  authorId: string;
  updatedAt: Date;
  embedding: number[] | null;
}> {
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
    authorId: formData.get('authorId') as string,
  };
  if (rawFormData.authorId !== session.user.id) {
    throw new Error('User does not match author');
  }
  if (rawFormData.id) {
    throw new Error('Template already exists');
  }
  const { embedding } = await generateEmbeddings(rawFormData.content);
  const embeddingSql = pgvector.toSql(embedding);

  type TemplateResult = {
    id: string;
    title: string;
    category: string;
    content: string;
    authorId: string;
    updatedAt: Date;
    embedding: number[] | null;
  };

  const result = await database.$queryRaw<TemplateResult[]>`
    INSERT INTO "Template" (
      "id",
      "category",
      "title",
      "content",
      "authorId",
      "updatedAt",
      "embedding"
    ) VALUES (
      gen_random_uuid()::text,
      ${rawFormData.category},
      ${rawFormData.name},
      ${rawFormData.content},
      ${session?.user?.id as string},
      NOW(),
      ${embeddingSql}::vector
    )
    RETURNING *
  `;

  const newTemplate = result[0];
  if (!newTemplate) {
    throw new Error('Failed to create template');
  }

  revalidatePath('/templates/');
  return newTemplate;
}
