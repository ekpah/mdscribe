'use client';

import { Badge } from '@repo/design-system/components/ui/badge';
import { Button } from '@repo/design-system/components/ui/button';
import { Card, CardContent } from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Separator } from '@repo/design-system/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface MigrationResult {
  totalTemplates: number;
  templatesWithoutEmbeddings: number;
  successfulEmbeddings: number;
  failedEmbeddings: number;
  errors: { templateId: string; error: string }[];
}

interface Props {
  templatesNeedingEmbedding: number;
  totalTemplates: number;
  onRefreshStats: () => Promise<void>;
  isRefreshingStats: boolean;
}

export default function MigrationInterface({
  templatesNeedingEmbedding,
  totalTemplates,
  onRefreshStats,
  isRefreshingStats,
}: Props) {
  const [batchSize, setBatchSize] = useState(10);
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(1000);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<MigrationResult | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [migrationMode, setMigrationMode] = useState<'missing' | 'all'>(
    'missing'
  );

  // Determine which mode to use based on available templates
  const effectiveMode = templatesNeedingEmbedding > 0 ? migrationMode : 'all';
  const templatesToProcess =
    effectiveMode === 'missing' ? templatesNeedingEmbedding : totalTemplates;

  // Update estimated time when parameters change
  useEffect(() => {
    // Calculate estimated time
    const calculateEstimatedTime = (
      templates: number,
      batch: number,
      delay: number
    ) => {
      const numBatches = Math.ceil(templates / batch);
      const totalDelay = (numBatches - 1) * delay;
      // Estimate 2 seconds per template for embedding generation
      const embeddingTime = templates * 2000;
      const totalMs = totalDelay + embeddingTime;

      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);

      if (minutes > 0) {
        return `~${minutes}m ${seconds}s`;
      }
      return `~${seconds}s`;
    };

    setEstimatedTime(
      calculateEstimatedTime(templatesToProcess, batchSize, delayBetweenBatches)
    );
  }, [templatesToProcess, batchSize, delayBetweenBatches]);

  const handleMigration = async () => {
    const actionText =
      effectiveMode === 'missing'
        ? `Embeddings für ${templatesToProcess} Vorlagen ohne Embeddings generieren`
        : `Embeddings für alle ${templatesToProcess} Vorlagen neu generieren`;

    if (
      !confirm(
        `Sind Sie sicher, dass Sie ${actionText} möchten? Dieser Vorgang kann nicht rückgängig gemacht werden.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const response = await fetch('/api/admin/migrate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchSize,
          delayBetweenBatches,
          dryRun: false,
          mode: effectiveMode,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setLastResult(result.data);
        if (result.data.failedEmbeddings === 0) {
          toast.success(
            `Migration erfolgreich abgeschlossen! ${result.data.successfulEmbeddings} Vorlagen mit Embeddings versehen.`
          );
        } else {
          toast.error(
            `Migration mit ${result.data.failedEmbeddings} Fehlern abgeschlossen. ${result.data.successfulEmbeddings} Vorlagen erfolgreich mit Embeddings versehen.`
          );
        }
      } else {
        toast.error(`Migration fehlgeschlagen: ${result.error}`);
      }
    } catch (error) {
      toast.error('Migration mit unerwartetem Fehler fehlgeschlagen');
      console.error('Migration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    onRefreshStats();
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection - Only show if there are templates that need embedding */}
      {templatesNeedingEmbedding > 0 && (
        <div className="space-y-3">
          <Label className="text-solarized-base00">Migrationsmodus</Label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="migrationMode"
                value="missing"
                checked={migrationMode === 'missing'}
                onChange={(e) =>
                  setMigrationMode(e.target.value as 'missing' | 'all')
                }
                className="text-solarized-blue"
              />
              <span className="text-sm text-solarized-base00">
                Nur fehlende Embeddings generieren ({templatesNeedingEmbedding}{' '}
                Vorlagen)
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="migrationMode"
                value="all"
                checked={migrationMode === 'all'}
                onChange={(e) =>
                  setMigrationMode(e.target.value as 'missing' | 'all')
                }
                className="text-solarized-blue"
              />
              <span className="text-sm text-solarized-base00">
                Alle Embeddings neu generieren ({totalTemplates} Vorlagen)
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="batchSize" className="text-solarized-base00">
            Batch-Größe
          </Label>
          <Input
            id="batchSize"
            type="number"
            min={1}
            max={50}
            value={batchSize}
            onChange={(e) =>
              setBatchSize(Number.parseInt(e.target.value) || 10)
            }
            className="border-solarized-base2"
          />
          <p className="text-solarized-base01 text-xs">
            Anzahl der Vorlagen pro Batch (1-50)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delay" className="text-solarized-base00">
            Verzögerung zwischen Batches (ms)
          </Label>
          <Input
            id="delay"
            type="number"
            min={0}
            value={delayBetweenBatches}
            onChange={(e) =>
              setDelayBetweenBatches(Number.parseInt(e.target.value) || 1000)
            }
            className="border-solarized-base2"
          />
          <p className="text-solarized-base01 text-xs">
            Verzögerung in Millisekunden zwischen den Batches
          </p>
        </div>
      </div>

      {/* Estimation */}
      <Card className="border-solarized-base2 bg-solarized-base3">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-solarized-base01" />
              <span className="text-sm text-solarized-base01">
                Geschätzte Zeit:
              </span>
            </div>
            <Badge variant="outline" className="text-solarized-blue">
              {estimatedTime}
            </Badge>
          </div>
          <div className="mt-2 text-solarized-base01 text-xs">
            {Math.ceil(templatesToProcess / batchSize)} Batches mit je {batchSize}{' '}
            Vorlagen
            {effectiveMode === 'all' && ' (alle Embeddings neu generieren)'}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleMigration}
          disabled={isLoading}
          className="flex items-center gap-2 bg-solarized-orange text-solarized-base3 hover:bg-solarized-red"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {effectiveMode === 'missing'
            ? 'Fehlende Embeddings generieren'
            : 'Alle Embeddings neu generieren'}
        </Button>

        <Button
          onClick={handleRefresh}
          variant="outline"
          className="flex items-center gap-2"
          disabled={isRefreshingStats}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshingStats ? 'animate-spin' : ''}`}
          />
          Status aktualisieren
        </Button>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 rounded-md border border-solarized-yellow/20 bg-solarized-yellow/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-solarized-yellow" />
        <div className="text-sm text-solarized-base00">
          <strong>Warnung:</strong> Diese Migration führt API-Aufrufe zum
          Embedding-Service durch und ändert die Datenbank.
          {effectiveMode === 'all' &&
            ' Das Neugenerieren aller Embeddings überschreibt vorhandene Embeddings.'}
          {' Verwenden Sie zuerst einen Testlauf, um die Konfiguration zu überprüfen.'}
        </div>
      </div>

      {/* Results Display */}
      {lastResult && (
        <Card className="border-solarized-base2">
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              {lastResult.failedEmbeddings === 0 ? (
                <CheckCircle className="h-5 w-5 text-solarized-green" />
              ) : (
                <XCircle className="h-5 w-5 text-solarized-orange" />
              )}
              <h3 className="font-semibold text-solarized-base00">
                Migrationsergebnisse
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-solarized-base01">Verarbeitet</div>
                <div className="font-semibold text-lg text-solarized-base00">
                  {lastResult.templatesWithoutEmbeddings}
                </div>
              </div>
              <div>
                <div className="text-sm text-solarized-base01">Erfolgreich</div>
                <div className="font-semibold text-lg text-solarized-green">
                  {lastResult.successfulEmbeddings}
                </div>
              </div>
              <div>
                <div className="text-sm text-solarized-base01">Fehlgeschlagen</div>
                <div className="font-semibold text-lg text-solarized-orange">
                  {lastResult.failedEmbeddings}
                </div>
              </div>
              <div>
                <div className="text-sm text-solarized-base01">
                  Erfolgsquote
                </div>
                <div className="font-semibold text-lg text-solarized-blue">
                  {lastResult.templatesWithoutEmbeddings > 0
                    ? Math.round(
                        (lastResult.successfulEmbeddings /
                          lastResult.templatesWithoutEmbeddings) *
                          100
                      )
                    : 0}
                  %
                </div>
              </div>
            </div>

            {lastResult.errors.length > 0 && (
              <>
                <Separator className="bg-solarized-base2" />
                <div>
                  <h4 className="mb-2 font-medium text-solarized-base00">
                    Fehler ({lastResult.errors.length})
                  </h4>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {lastResult.errors.map(({ templateId, error }, index) => (
                      <div
                        key={index}
                        className="rounded border border-solarized-red/20 bg-solarized-red/10 p-2 text-xs"
                      >
                        <span className="font-mono text-solarized-base01">
                          {templateId}:
                        </span>{' '}
                        <span className="text-solarized-red">{error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
