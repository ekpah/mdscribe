'use server';
import { generateEmbeddings } from '@/app/templates/_actions/embed-template';
import { database } from '@repo/database';
import pgvector from 'pgvector';

interface MigrationResult {
  totalTemplates: number;
  templatesWithoutEmbeddings: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  errors: { templateId: string; error: string }[];
}

interface TemplateWithoutEmbedding {
  id: string;
  content: string;
}

/**
 * One-time migration function to embed all templates that don't have embeddings yet.
 * This function processes templates in batches to avoid overwhelming the embedding service.
 */
export async function migrateEmbedAllTemplates(
  batchSize = 10,
  delayBetweenBatches = 1000
): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalTemplates: 0,
    templatesWithoutEmbeddings: 0,
    successfulEmbeddings: 0,
    failedEmbeddings: 0,
    errors: [],
  };

  try {
    // Get total templates count
    const totalCount = await database.template.count();
    result.totalTemplates = totalCount;

    // Get all templates without embeddings using raw SQL
    const templatesWithoutEmbeddings = await database.$queryRaw<
      TemplateWithoutEmbedding[]
    >`
      SELECT id, content 
      FROM "Template" 
      WHERE embedding IS NULL
    `;

    result.templatesWithoutEmbeddings = templatesWithoutEmbeddings.length;

    console.log(
      `Found ${result.templatesWithoutEmbeddings} templates without embeddings out of ${result.totalTemplates} total templates`
    );

    if (result.templatesWithoutEmbeddings === 0) {
      console.log(
        'All templates already have embeddings. Migration not needed.'
      );
      return result;
    }

    // Process templates in batches
    for (let i = 0; i < templatesWithoutEmbeddings.length; i += batchSize) {
      const batch = templatesWithoutEmbeddings.slice(i, i + batchSize);

      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          templatesWithoutEmbeddings.length / batchSize
        )} (${batch.length} templates)`
      );

      // Process each template in the current batch
      for (const template of batch) {
        try {
          // Generate embedding for the template content
          const { embedding } = await generateEmbeddings(template.content);
          const embeddingSql = pgvector.toSql(embedding);

          // Update the template with the embedding using raw SQL for proper vector handling
          await database.$queryRaw`
            UPDATE "Template" 
            SET "embedding" = ${embeddingSql}::vector
            WHERE "id" = ${template.id}
          `;

          result.successfulEmbeddings++;
          console.log(`✅ Embedded template ${template.id}`);
        } catch (error) {
          result.failedEmbeddings++;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            templateId: template.id,
            error: errorMessage,
          });
          console.error(
            `❌ Failed to embed template ${template.id}:`,
            errorMessage
          );
        }
      }

      // Add delay between batches to avoid rate limiting
      if (
        i + batchSize < templatesWithoutEmbeddings.length &&
        delayBetweenBatches > 0
      ) {
        console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches)
        );
      }
    }

    console.log('\n📊 Migration completed!');
    console.log(`Total templates: ${result.totalTemplates}`);
    console.log(
      `Templates without embeddings: ${result.templatesWithoutEmbeddings}`
    );
    console.log(`Successfully embedded: ${result.successfulEmbeddings}`);
    console.log(`Failed embeddings: ${result.failedEmbeddings}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const { templateId, error } of result.errors) {
        console.log(`  Template ${templateId}: ${error}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Migration failed with error:', error);
    throw error;
  }
}

/**
 * Check how many templates need embedding (without actually running the migration)
 */
export async function checkTemplatesNeedingEmbedding(): Promise<{
  totalTemplates: number;
  templatesWithoutEmbeddings: number;
  templatesWithEmbeddings: number;
}> {
  const totalTemplates = await database.template.count();

  // Use raw SQL to count templates without embeddings
  const [{ count: templatesWithoutEmbeddings }] = await database.$queryRaw<
    [{ count: bigint }]
  >`
    SELECT COUNT(*) as count
    FROM "Template" 
    WHERE embedding IS NULL
  `;

  const templatesWithoutEmbeddingsNumber = Number(templatesWithoutEmbeddings);
  const templatesWithEmbeddings =
    totalTemplates - templatesWithoutEmbeddingsNumber;

  return {
    totalTemplates,
    templatesWithoutEmbeddings: templatesWithoutEmbeddingsNumber,
    templatesWithEmbeddings,
  };
}
