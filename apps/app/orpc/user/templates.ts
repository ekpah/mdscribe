import { authed } from '@/orpc';
import { z } from 'zod';
import pgvector from 'pgvector';
import { revalidatePath } from 'next/cache';

// Validation schemas
const createTemplateSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string(),
});

const editTemplateSchema = z.object({
  id: z.string(),
  category: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string(),
});

// Template routes
const getFavoriteTemplatesHandler = authed.handler(async ({ context }) => {
  const favoriteTemplates = await context.db.template.findMany({
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

  return favoriteTemplates;
});

const getAuthoredTemplatesHandler = authed.handler(async ({ context }) => {
  const userTemplates = await context.db.template.findMany({
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

  return userTemplates;
});

const getRecentActivityHandler = authed.handler(async ({ context }) => {
  const recentEvents = await context.db.usageEvent.findMany({
    where: {
      userId: context.session.user.id,
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: 5,
  });

  return recentEvents;
});

// Helper function to generate embeddings
async function generateEmbeddings(content: string, title: string, category: string) {
  const { generateEmbeddings: genEmbed } = await import('@/app/templates/_actions/embed-template');
  return genEmbed(content, title, category);
}

// Create template mutation
const createTemplateHandler = authed
  .input(createTemplateSchema)
  .handler(async ({ context, input }) => {
    const { category, title, content } = input;

    // Generate embedding
    const { embedding } = await generateEmbeddings(content, title, category);
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

    const result = await context.db.$queryRaw<TemplateResult[]>`
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
        ${category},
        ${title},
        ${content},
        ${context.session.user.id},
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
  });

// Edit template mutation
const editTemplateHandler = authed
  .input(editTemplateSchema)
  .handler(async ({ context, input }) => {
    const { id, category, title, content } = input;

    // Generate new embedding for the updated content
    const { embedding } = await generateEmbeddings(content, title, category);
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

    const result = await context.db.$queryRaw<TemplateResult[]>`
      UPDATE "Template" 
      SET 
        "category" = ${category},
        "title" = ${title},
        "content" = ${content},
        "updatedAt" = NOW(),
        "embedding" = ${embeddingSql}::vector
      WHERE 
        "id" = ${id} 
        AND "authorId" = ${context.session.user.id}
      RETURNING *
    `;

    const updatedTemplate = result[0];
    if (!updatedTemplate) {
      throw new Error('Failed to update template or template not found');
    }

    revalidatePath(`/templates/${updatedTemplate.id}`);
    return updatedTemplate;
  });

export const templatesHandler = {
  favourites: getFavoriteTemplatesHandler,
  authored: getAuthoredTemplatesHandler,
  recentActivity: getRecentActivityHandler,
  create: createTemplateHandler,
  edit: editTemplateHandler,
};
