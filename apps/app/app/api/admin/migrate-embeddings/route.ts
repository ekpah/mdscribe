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
 * Migrates template embeddings based on the specified mode
 * - 'missing': Only generates embeddings for templates without them
 * - 'all': Regenerates embeddings for all templates
 * Processes templates in batches to avoid overwhelming the embedding service
 */
async function migrateTemplateEmbeddings(
  mode: 'missing' | 'all' = 'missing',
  batchSize = 10,
  delay = 1000
) {
  const stats = {
    total: 0,
    processed: 0,
    failed: 0,
    errors: [] as Array<{ templateId: string; error: string }>,
  };

  console.log(`🚀 Starting embedding migration in "${mode}" mode`);
  console.log(`📊 Configuration: batchSize=${batchSize}, delay=${delay}ms`);

  // Count total templates
  stats.total = await database.template.count();
  console.log(`📈 Total templates in database: ${stats.total}`);

  // Get templates to process based on mode
  let templatesToProcess: Array<{ id: string; content: string }>;

  if (mode === 'missing') {
    // Only templates without embeddings
    templatesToProcess = await database.$queryRaw<
      Array<{ id: string; content: string }>
    >`
      SELECT id, content FROM "Template" WHERE embedding IS NULL
    `;
    console.log(
      `🔍 Found ${templatesToProcess.length} templates without embeddings`
    );
  } else {
    // All templates
    templatesToProcess = await database.$queryRaw<
      Array<{ id: string; content: string }>
    >`
      SELECT id, content FROM "Template"
    `;
    console.log(
      `🔄 Processing all ${templatesToProcess.length} templates for regeneration`
    );
  }

  if (templatesToProcess.length === 0) {
    console.log(`✅ No templates to process in "${mode}" mode`);
    return {
      totalTemplates: stats.total,
      templatesWithoutEmbeddings: 0,
      successfulEmbeddings: 0,
      failedEmbeddings: 0,
      errors: [],
    };
  }

  const totalBatches = Math.ceil(templatesToProcess.length / batchSize);
  console.log(
    `📦 Will process ${templatesToProcess.length} templates in ${totalBatches} batches`
  );

  // Process templates in batches
  for (let i = 0; i < templatesToProcess.length; i += batchSize) {
    const batch = templatesToProcess.slice(i, i + batchSize);
    const currentBatch = Math.floor(i / batchSize) + 1;

    console.log(
      `\n🔄 Processing batch ${currentBatch}/${totalBatches} (${batch.length} templates)`
    );

    // Generate embeddings for each template in the batch
    for (const template of batch) {
      try {
        console.log(`  ⚡ Generating embedding for template ${template.id}...`);
        const { embedding } = await generateEmbeddings(template.content);
        await database.$queryRaw`
          UPDATE "Template" 
          SET "embedding" = ${pgvector.toSql(embedding)}::vector
          WHERE "id" = ${template.id}
        `;
        stats.processed++;
        console.log(`  ✅ Successfully embedded template ${template.id}`);
      } catch (error) {
        stats.failed++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push({
          templateId: template.id,
          error: errorMessage,
        });
        console.log(
          `  ❌ Failed to embed template ${template.id}: ${errorMessage}`
        );
      }
    }

    console.log(
      `📊 Batch ${currentBatch} complete: ${stats.processed} successful, ${stats.failed} failed`
    );

    // Wait between batches to avoid rate limiting
    if (i + batchSize < templatesToProcess.length && delay > 0) {
      console.log(`⏳ Waiting ${delay}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.log('\n🎉 Migration completed!');
  console.log('📊 Final results:');
  console.log(`  - Total processed: ${templatesToProcess.length}`);
  console.log(`  - Successful: ${stats.processed}`);
  console.log(`  - Failed: ${stats.failed}`);
  console.log(
    `  - Success rate: ${templatesToProcess.length > 0 ? Math.round((stats.processed / templatesToProcess.length) * 100) : 0}%`
  );

  if (stats.errors.length > 0) {
    console.log('❌ Errors encountered:');
    for (const { templateId, error } of stats.errors) {
      console.log(`  - ${templateId}: ${error}`);
    }
  }

  return {
    totalTemplates: stats.total,
    templatesWithoutEmbeddings: templatesToProcess.length,
    successfulEmbeddings: stats.processed,
    failedEmbeddings: stats.failed,
    errors: stats.errors,
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
    const {
      mode = 'missing',
      batchSize = 10,
      delayBetweenBatches = 1000,
    } = body;

    // Validate mode parameter
    if (mode !== 'missing' && mode !== 'all') {
      return Response.json(
        { error: 'mode must be either "missing" or "all"' },
        { status: 400 }
      );
    }

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
      mode,
      batchSize,
      delayBetweenBatches
    );

    const modeText =
      mode === 'missing'
        ? 'Missing embeddings generated'
        : 'All embeddings regenerated';

    return Response.json({
      success: true,
      data: result,
      message: `${modeText}: ${result.successfulEmbeddings} embedded, ${result.failedEmbeddings} failed`,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'Migration failed' },
      { status: 500 }
    );
  }
}
