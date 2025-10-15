'use server';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import pgvector from 'pgvector';
import { generateEmbeddings } from './embed-template';

export default async function editTemplate(formData: FormData) {
  'use server';
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('User not found');
  }

  // handle submitting the template to save it to prisma (Neon-Postgres)
  const rawFormData = {
    id: formData.get('id') as string,
    category: formData.get('category') as string,
    name: formData.get('name') as string,
    content: formData.get('content') as string,
    authorId: session?.user?.id as string,
  };

  if (rawFormData.authorId !== session?.user?.id) {
    throw new Error('Permission denied');
  }

  // Validate required fields
  if (!rawFormData.category || rawFormData.category.trim() === '') {
    throw new Error('Category is required and cannot be empty');
  }
  if (!rawFormData.name || rawFormData.name.trim() === '') {
    throw new Error('Name is required and cannot be empty');
  }

  // Generate new embedding for the updated content
  const { embedding } = await generateEmbeddings(
    rawFormData.content,
    rawFormData.name,
    rawFormData.category
  );
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

  // Use raw SQL query to properly handle the vector embedding update
  const result = await database.$queryRaw<TemplateResult[]>`
    UPDATE "Template" 
    SET 
      "category" = ${rawFormData.category},
      "title" = ${rawFormData.name},
      "content" = ${rawFormData.content},
      "updatedAt" = NOW(),
      "embedding" = ${embeddingSql}::vector
    WHERE 
      "id" = ${rawFormData.id} 
      AND "authorId" = ${session.user.id}
    RETURNING *
  `;

  const updatedTemplate = result[0];
  if (!updatedTemplate) {
    throw new Error('Failed to update template or template not found');
  }

  revalidatePath(`/templates/${updatedTemplate.id}`);
  return updatedTemplate;
}
