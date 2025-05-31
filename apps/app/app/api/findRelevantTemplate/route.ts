'use server';
import { generateEmbeddings } from '@/app/templates/_actions/embed-template';
import { auth } from '@/auth';
import { database } from '@repo/database';
import { headers } from 'next/headers';
import pgvector from 'pgvector';

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

export async function POST(req: Request) {
  try {
    // Get session for authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embeddings for the user query
    const { embedding } = await generateEmbeddings(query);
    const embeddingSql = pgvector.toSql(embedding);

    // Use raw SQL for vector similarity search to get top results
    const templates = await database.$queryRaw<TemplateSearchResult[]>`
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
