import { auth } from '@/auth';
import { allowAdminAccess } from '@/flags';
import {
  checkTemplatesNeedingEmbedding,
  migrateEmbedAllTemplates,
} from '@/lib/migration-embed-templates';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function GET() {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowAdminAccessFlag = await allowAdminAccess();
    if (!allowAdminAccessFlag) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check current state without running migration
    const stats = await checkTemplatesNeedingEmbedding();

    return Response.json({
      success: true,
      data: stats,
      message: `Found ${stats.templatesWithoutEmbeddings} templates without embeddings out of ${stats.totalTemplates} total templates`,
    });
  } catch (error) {
    console.error('Error checking templates needing embedding:', error);
    return Response.json(
      {
        success: false,
        error: 'Failed to check templates needing embedding',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowAdminAccessFlag = await allowAdminAccess();
    if (!allowAdminAccessFlag) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For additional security, you might want to check if the user is an admin
    // if (!session.user.isAdmin) {
    //   return Response.json({ error: 'Forbidden' }, { status: 403 });
    // }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { batchSize = 10, delayBetweenBatches = 1000, dryRun = false } = body;

    // Validate parameters
    if (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 50) {
      return Response.json(
        { error: 'Invalid batchSize. Must be a number between 1 and 50.' },
        { status: 400 }
      );
    }

    if (typeof delayBetweenBatches !== 'number' || delayBetweenBatches < 0) {
      return Response.json(
        {
          error: 'Invalid delayBetweenBatches. Must be a non-negative number.',
        },
        { status: 400 }
      );
    }

    if (dryRun) {
      // Just check the state without running migration
      const stats = await checkTemplatesNeedingEmbedding();
      return Response.json({
        success: true,
        dryRun: true,
        data: stats,
        message: `Dry run: Would embed ${stats.templatesWithoutEmbeddings} templates`,
      });
    }

    // Run the actual migration
    console.log(
      `Starting embedding migration initiated by user ${session.user.id}`
    );
    const result = await migrateEmbedAllTemplates(
      batchSize,
      delayBetweenBatches
    );

    return Response.json({
      success: true,
      data: result,
      message: `Migration completed! Successfully embedded ${result.successfulEmbeddings} templates, ${result.failedEmbeddings} failed.`,
    });
  } catch (error) {
    console.error('Error running embedding migration:', error);
    return Response.json(
      {
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
