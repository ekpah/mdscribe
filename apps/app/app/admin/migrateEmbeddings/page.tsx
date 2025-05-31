import { auth } from '@/auth';
import { allowAdminAccess } from '@/flags';
import { checkTemplatesNeedingEmbedding } from '@/lib/migration-embed-templates';
import { Badge } from '@repo/design-system/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Separator } from '@repo/design-system/components/ui/separator';
import { AlertCircle, CheckCircle, Database, XCircle, Zap } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import MigrationInterface from './_components/MigrationInterface';

export default async function MigrateEmbeddingsPage() {
  // Check authentication and authorization
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/');
  }

  const allowAdminAccessFlag = await allowAdminAccess();
  if (!allowAdminAccessFlag) {
    redirect('/');
  }

  // Get current migration status
  const stats = await checkTemplatesNeedingEmbedding();

  return (
    <div className="min-h-screen bg-solarized-base3 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-bold text-3xl text-solarized-base00">
            Template Embedding Migration
          </h1>
          <p className="text-solarized-base01">
            Manage and execute one-time migration to embed all templates that
            don't have embeddings yet.
          </p>
        </div>

        {/* Current Status Card */}
        <Card className="border-solarized-base2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-solarized-blue" />
              <CardTitle className="text-solarized-base00">
                Current Status
              </CardTitle>
            </div>
            <CardDescription>
              Overview of templates and their embedding status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-solarized-base01">
                    Total Templates
                  </Badge>
                </div>
                <span className="font-semibold text-2xl text-solarized-base00">
                  {stats.totalTemplates}
                </span>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-solarized-green" />
                  <Badge variant="outline" className="text-solarized-green">
                    With Embeddings
                  </Badge>
                </div>
                <span className="font-semibold text-2xl text-solarized-green">
                  {stats.templatesWithEmbeddings}
                </span>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-solarized-orange" />
                  <Badge variant="outline" className="text-solarized-orange">
                    Need Embedding
                  </Badge>
                </div>
                <span className="font-semibold text-2xl text-solarized-orange">
                  {stats.templatesWithoutEmbeddings}
                </span>
              </div>
            </div>

            <Separator className="bg-solarized-base2" />

            <div className="flex items-center gap-2">
              {stats.templatesWithoutEmbeddings === 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-solarized-green" />
                  <span className="font-medium text-solarized-green">
                    All templates have embeddings! No migration needed.
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-solarized-orange" />
                  <span className="font-medium text-solarized-orange">
                    {stats.templatesWithoutEmbeddings} templates need embedding
                    migration.
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Migration Controls */}
        {stats.templatesWithoutEmbeddings > 0 && (
          <Card className="border-solarized-base2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-solarized-yellow" />
                <CardTitle className="text-solarized-base00">
                  Migration Controls
                </CardTitle>
              </div>
              <CardDescription>
                Execute the embedding migration with configurable batch settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MigrationInterface
                templatesNeedingEmbedding={stats.templatesWithoutEmbeddings}
              />
            </CardContent>
          </Card>
        )}

        {/* Information Card */}
        <Card className="border-solarized-base2">
          <CardHeader>
            <CardTitle className="text-solarized-base00">
              Migration Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-solarized-base01">
            <div>
              <strong>What this does:</strong> Generates vector embeddings for
              all templates that don't have them yet, enabling semantic search
              functionality.
            </div>
            <div>
              <strong>How it works:</strong> Processes templates in configurable
              batches with delays between batches to avoid overwhelming the
              embedding service.
            </div>
            <div>
              <strong>Safety:</strong> Only processes templates without
              embeddings, can be run multiple times safely, includes
              comprehensive error handling and reporting.
            </div>
            <div>
              <strong>Recommended settings:</strong> Start with batch size 10
              and 1000ms delay. Reduce batch size or increase delay if you
              encounter rate limits.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
