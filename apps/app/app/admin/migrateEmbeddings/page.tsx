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
import { toast } from 'sonner';
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
        setError(result.error || 'Fehler beim Laden der Statistiken');
        toast.error('Fehler beim Laden der Embedding-Statistiken');
      }
    } catch (err) {
      setError('Fehler beim Laden der Statistiken');
      toast.error('Fehler beim Laden der Embedding-Statistiken');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefreshStats = async () => {
    setIsLoading(true);
    await fetchStats();
    toast.success('Statistiken aktualisiert');
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
              <span>Embedding-Statistiken werden geladen...</span>
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
                Seite konnte nicht geladen werden
              </h2>
              <p className="text-solarized-base01">
                {error || 'Zugriff auf diese Seite nicht möglich'}
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
            Template-Embedding-Migration
          </h1>
          <p className="text-solarized-base01">
            Verwalten und Ausführen der einmaligen Migration, um alle Vorlagen
            mit Embeddings zu versehen, die noch keine haben.
          </p>
        </div>

        {/* Current Status Card */}
        <Card className="border-solarized-base2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-solarized-blue" />
              <CardTitle className="text-solarized-base00">
                Aktueller Status
              </CardTitle>
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-solarized-base01" />
              )}
            </div>
            <CardDescription>
              Übersicht der Vorlagen und ihres Embedding-Status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-solarized-base01">
                    Vorlagen gesamt
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
                    Mit Embeddings
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
                    Embedding benötigt
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
                    Alle Vorlagen haben Embeddings! Keine Migration erforderlich.
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-solarized-orange" />
                  <span className="font-medium text-solarized-orange">
                    {stats.templatesWithoutEmbeddings} Vorlagen benötigen
                    Embedding-Migration.
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
                  Embedding-Verwaltung
                </CardTitle>
              </div>
              <CardDescription>
                Fehlende Embeddings generieren oder alle Embeddings mit
                konfigurierbaren Batch-Einstellungen neu erstellen
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
                  Embedding-Verwaltung
                </CardTitle>
              </div>
              <CardDescription>
                Embeddings für alle Vorlagen neu generieren (nützlich bei
                Änderung des Embedding-Modells)
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
              Informationen zur Embedding-Verwaltung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-solarized-base01">
            <div>
              <strong>Fehlende Embeddings generieren:</strong> Erstellt
              Vektor-Embeddings für Vorlagen, die noch keine haben, und
              ermöglicht so die semantische Suchfunktion für diese Vorlagen.
            </div>
            <div>
              <strong>Alle Embeddings neu generieren:</strong> Erstellt
              Embeddings für alle Vorlagen neu und überschreibt dabei
              vorhandene. Nützlich, wenn das Embedding-Modell aktualisiert
              oder verbessert wurde.
            </div>
            <div>
              <strong>Funktionsweise:</strong> Verarbeitet Vorlagen in
              konfigurierbaren Batches mit Verzögerungen zwischen den Batches,
              um den Embedding-Service nicht zu überlasten.
            </div>
            <div>
              <strong>Sicherheit:</strong> Kann mehrfach sicher ausgeführt
              werden, enthält umfassende Fehlerbehandlung und Berichterstattung.
              Der Modus für fehlende Embeddings verarbeitet nur Vorlagen ohne
              Embeddings.
            </div>
            <div>
              <strong>Empfohlene Einstellungen:</strong> Beginnen Sie mit
              Batch-Größe 10 und 1000ms Verzögerung. Reduzieren Sie die
              Batch-Größe oder erhöhen Sie die Verzögerung bei Rate-Limits.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
