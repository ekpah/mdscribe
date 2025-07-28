'use server';
import { database } from '@repo/database';
import { type EmbeddingModel, embed } from 'ai';
import { headers } from 'next/headers';
import pgvector from 'pgvector';
import { voyage } from 'voyage-ai-provider';
import { VoyageAIClient } from 'voyageai';
import { auth } from '@/auth';

const client = new VoyageAIClient({ apiKey: 'VOYAGE_API_KEY' });

// Type definition for template search results
interface TemplateSearchResult {
  id: string;
  title: string;
  category: string;
  content: string;
  authorId: string;
  updatedAt: Date;
  similarity: number;
}

const generateEmbeddings = async (
  content: string,
  differentialDiagnosis?: string
): Promise<{ embedding: number[]; content: string }> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const contentWithMetadata = differentialDiagnosis
    ? `---
diagnosis: ${differentialDiagnosis}
---
${content}`
    : content;
  const { embedding } = await client.embed({
    input: contentWithMetadata,
    model: 'voyage-3-large',
  });

  // await embed({
  //   model: voyage.textEmbeddingModel(
  //     'voyage-3-large'
  //   ) as unknown as EmbeddingModel<string>,
  //   value: contentWithMetadata,
  //   experimental_telemetry: {
  //     isEnabled: true,
  //     metadata: {
  //       userId: session?.user?.id || 'unknown',
  //       value: contentWithMetadata,
  //     },
  //   },
  // });
  return { embedding, content };
};

export async function POST(req: Request) {
  try {
    // Get session for authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { query, differentialDiagnosis } = await req.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embeddings for the user query
    const { embedding } = await generateEmbeddings(
      query,
      differentialDiagnosis
    );
    const embeddingSql = pgvector.toSql(embedding);

    // Use raw SQL for vector similarity search to get top results
    const similarityResults = await database.$queryRaw<TemplateSearchResult[]>`
      SELECT 
        id,
        title,
        category,
        content,
        "authorId",
        "updatedAt",
        (1 - (embedding <=> ${embeddingSql}::vector)) as similarity
      FROM "Template"
      WHERE embedding IS NOT NULL
      AND (1 - (embedding <=> ${embeddingSql}::vector)) > 0.3
      ORDER BY embedding <-> ${embeddingSql}::vector
      LIMIT 5
    `;

    // Get the IDs from similarity results
    const templateIds = similarityResults.map((t) => t.id);

    if (templateIds.length === 0) {
      return Response.json({
        templates: [],
        count: 0,
      });
    }

    // Fetch complete template data with favorites information
    const templatesWithFavorites = await database.template.findMany({
      where: {
        id: { in: templateIds },
      },
      include: {
        favouriteOf: {
          select: { id: true },
        },
        _count: {
          select: { favouriteOf: true },
        },
      },
    });

    // Merge similarity scores with template data
    const templates = similarityResults.map((simResult) => {
      const templateData = templatesWithFavorites.find(
        (t) => t.id === simResult.id
      );
      return {
        ...simResult,
        favouriteOf: templateData?.favouriteOf || [],
        _count: templateData?._count || { favouriteOf: 0 },
      };
    });

    return Response.json({
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error finding relevant templates:', error);
    return Response.json(
      { error: 'Failed to search templates' },
      { status: 500 }
    );
  }
}
