import { auth } from '@/auth';
import { allowAdminAccess } from '@/flags';
import { database } from '@repo/database';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Checks how many templates need embeddings without running the migration
 */
async function getEmbeddingStats() {
  const total = await database.template.count();
  const [{ count }] = await database.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "Template" WHERE embedding IS NULL
  `;
  const needingEmbeddings = Number(count);

  return {
    totalTemplates: total,
    templatesWithoutEmbeddings: needingEmbeddings,
    templatesWithEmbeddings: total - needingEmbeddings,
  };
}

export async function GET() {
  try {
    // Check authentication and authorization
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowAdminAccessFlag = await allowAdminAccess();
    if (!allowAdminAccessFlag) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get current migration status
    const stats = await getEmbeddingStats();

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching embedding stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
