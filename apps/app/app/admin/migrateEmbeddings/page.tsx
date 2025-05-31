'use client';

import { Badge } from '@repo/design-system/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Separator } from '@repo/design-system/components/ui/separator';
import {
  AlertCircle,
  CheckCircle,
  Database,
  Loader2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import MigrationInterface from './_components/MigrationInterface';

interface EmbeddingStats {
  totalTemplates: number;
  templatesWithoutEmbeddings: number;
  templatesWithEmbeddings: number;
}

export default function MigrateEmbeddingsPage() {
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/embedding-stats');
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch stats');
        toast.error('Failed to fetch embedding stats');
      }
    } catch (err) {
      setError('Failed to fetch stats');
      toast.error('Failed to fetch embedding stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefreshStats = async () => {
    setIsLoading(true);
    await fetchStats();
    toast.success('Stats refreshed');
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-solarized-base3 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="flex items-center gap-2 text-solarized-base01">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading embedding stats...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-solarized-base3 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="space-y-2 text-center">
              <XCircle className="mx-auto h-8 w-8 text-solarized-red" />
              <h2 className="font-semibold text-lg text-solarized-base00">
                Failed to load page
              </h2>
              <p className="text-solarized-base01">
                {error || 'Unable to access this page'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-solarized-base01" />
              )}
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
                  Embedding Management
                </CardTitle>
              </div>
              <CardDescription>
                Generate missing embeddings or regenerate all embeddings with
                configurable batch settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MigrationInterface
                templatesNeedingEmbedding={stats.templatesWithoutEmbeddings}
                totalTemplates={stats.totalTemplates}
                onRefreshStats={handleRefreshStats}
                isRefreshingStats={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* Regeneration Controls - Always show if there are templates */}
        {stats.totalTemplates > 0 && stats.templatesWithoutEmbeddings === 0 && (
          <Card className="border-solarized-base2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-solarized-yellow" />
                <CardTitle className="text-solarized-base00">
                  Embedding Management
                </CardTitle>
              </div>
              <CardDescription>
                Regenerate embeddings for all templates (useful if embedding
                model has changed)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MigrationInterface
                templatesNeedingEmbedding={stats.templatesWithoutEmbeddings}
                totalTemplates={stats.totalTemplates}
                onRefreshStats={handleRefreshStats}
                isRefreshingStats={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* Information Card */}
        <Card className="border-solarized-base2">
          <CardHeader>
            <CardTitle className="text-solarized-base00">
              Embedding Management Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-solarized-base01">
            <div>
              <strong>Generate Missing Embeddings:</strong> Creates vector
              embeddings for templates that don't have them yet, enabling
              semantic search functionality for those templates.
            </div>
            <div>
              <strong>Regenerate All Embeddings:</strong> Recreates embeddings
              for all templates, overwriting existing ones. Useful when the
              embedding model has been updated or improved.
            </div>
            <div>
              <strong>How it works:</strong> Processes templates in configurable
              batches with delays between batches to avoid overwhelming the
              embedding service.
            </div>
            <div>
              <strong>Safety:</strong> Can be run multiple times safely,
              includes comprehensive error handling and reporting. Missing
              embedding mode only processes templates without embeddings.
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
