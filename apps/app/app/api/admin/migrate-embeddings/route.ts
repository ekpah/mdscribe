import { auth } from '@/auth';
import { allowAdminAccess } from '@/flags';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

import { database } from '@repo/database';
import { embed } from 'ai';
import pgvector from 'pgvector';
import { voyage } from 'voyage-ai-provider';

const generateEmbeddings = async (
  content: string
): Promise<{ embedding: number[]; content: string }> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-3-large'),
    value: content,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
      },
    },
  });
  return { embedding, content };
};

/**
 * Migrates all templates without embeddings by generating and storing vector embeddings
 * Processes templates in batches to avoid overwhelming the embedding service
 */
async function migrateTemplateEmbeddings(batchSize = 10, delay = 1000) {
  const stats = { total: 0, processed: 0, failed: 0, errors: [] as string[] };

  // Count total templates and find those without embeddings
  stats.total = await database.template.count();
  const templatesNeedingEmbeddings = await database.$queryRaw<
    Array<{ id: string; content: string }>
  >`
    SELECT id, content FROM "Template" WHERE embedding IS NULL
  `;

  // Process templates in batches
  for (let i = 0; i < templatesNeedingEmbeddings.length; i += batchSize) {
    const batch = templatesNeedingEmbeddings.slice(i, i + batchSize);

    // Generate embeddings for each template in the batch
    for (const template of batch) {
      try {
        const { embedding } = await generateEmbeddings(template.content);
        await database.$queryRaw`
          UPDATE "Template" 
          SET "embedding" = ${pgvector.toSql(embedding)}::vector
          WHERE "id" = ${template.id}
        `;
        stats.processed++;
      } catch (error) {
        stats.failed++;
        stats.errors.push(
          `Template ${template.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Wait between batches to avoid rate limiting
    if (i + batchSize < templatesNeedingEmbeddings.length && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    totalTemplates: stats.total,
    templatesWithoutEmbeddings: templatesNeedingEmbeddings.length,
    successfulEmbeddings: stats.processed,
    failedEmbeddings: stats.failed,
    errors: stats.errors.map((error) => ({ error })),
  };
}

/**
 * Validates user authentication and admin access
 */
async function validateAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const isAdminAllowed = await allowAdminAccess();
  if (!isAdminAllowed) {
    return { error: 'Forbidden', status: 403 };
  }

  return { session };
}

/**
 * POST endpoint - Runs the embedding migration or dry run
 */
export async function POST(req: NextRequest) {
  try {
    // Check if user has access
    const access = await validateAccess();
    if ('error' in access) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    // Parse and validate request parameters
    const body = await req.json().catch(() => ({}));
    const { batchSize = 10, delayBetweenBatches = 1000 } = body;

    if (batchSize < 1 || batchSize > 50) {
      return Response.json(
        { error: 'batchSize must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (delayBetweenBatches < 0) {
      return Response.json(
        { error: 'delayBetweenBatches must be non-negative' },
        { status: 400 }
      );
    }

    // Run the actual migration
    const result = await migrateTemplateEmbeddings(
      batchSize,
      delayBetweenBatches
    );

    return Response.json({
      success: true,
      data: result,
      message: `Migration completed: ${result.successfulEmbeddings} embedded, ${result.failedEmbeddings} failed`,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'Migration failed' },
      { status: 500 }
    );
  }
}
