'use client';

import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ExternalLinkIcon,
} from '@radix-ui/react-icons';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { StarIcon } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import addFavourite from '../_actions/add-favourite';
import removeFavourite from '../_actions/remove-favourite';

// Type definition for template search results
interface TemplateSearchResult {
  id: string;
  title: string;
  category: string;
  content: string;
  authorId: string;
  updatedAt: Date;
  similarity: number;
  favouriteOf?: Array<{ id: string }>;
  _count?: { favouriteOf: number };
}

interface SearchResponse {
  templates: TemplateSearchResult[];
  count: number;
}

const formatCount = (count: number): string => {
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toString();
};

export default function FindTemplatePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TemplateSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favouriteStates, setFavouriteStates] = useState<
    Record<string, boolean>
  >({});

  const { data: session } = useSession();
  const isLoggedIn = !!session?.user?.id;

  if (!isLoggedIn) {
    redirect('/');
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // get the differential diagnosis from the query from llm call
      const differentialDiagnosisResponse = await fetch(
        '/api/scribe/diagnosis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: JSON.stringify({ anamnese: query }) }),
        }
      );

      if (!differentialDiagnosisResponse.ok) {
        throw new Error(
          `HTTP error! status: ${differentialDiagnosisResponse.status}`
        );
      }

      const { text: differentialDiagnosis } =
        await differentialDiagnosisResponse.json();
      const response = await fetch('/api/findRelevantTemplate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          differentialDiagnosis,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SearchResponse = await response.json();

      // Show only top 3 results
      const topResults = data.templates.slice(0, 3);
      setResults(topResults);

      // Initialize favorite states
      const initialFavoriteStates: Record<string, boolean> = {};
      for (const template of topResults) {
        const isFavorited = template.favouriteOf?.some(
          (user) => user.id === session?.user?.id
        );
        initialFavoriteStates[template.id] = isFavorited ?? false;
      }
      setFavouriteStates(initialFavoriteStates);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Fehler beim Suchen der Vorlagen'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavourite = async (
    templateId: string,
    currentState: boolean
  ) => {
    if (!isLoggedIn) {
      toast.error('Bitte melden Sie sich an, um Favoriten zu verwalten');
      return;
    }

    try {
      // Optimistically update the UI
      setFavouriteStates((prev) => ({
        ...prev,
        [templateId]: !currentState,
      }));

      if (currentState) {
        await removeFavourite({ templateId });
        toast.success('Favorit entfernt');
      } else {
        await addFavourite({ templateId });
        toast.success('Favorit gespeichert');
      }
    } catch (err) {
      // Revert the optimistic update
      setFavouriteStates((prev) => ({
        ...prev,
        [templateId]: currentState,
      }));
      toast.error('Fehler beim Aktualisieren der Favoriten');
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-bold text-3xl text-solarized-base03">
            Relevante Vorlagen finden
          </h1>
          <p className="mt-2 text-solarized-base01">
            Suchen Sie nach Vorlagen mit natürlichsprachigen Abfragen
          </p>
        </div>

        {/* Search Form */}
        <form className="flex gap-2" onSubmit={handleSearch}>
          <Input
            className="flex-1"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Beschreiben Sie, nach welcher Art von Vorlage Sie suchen..."
            type="text"
            value={query}
          />
          <Button disabled={isLoading || !query.trim()} type="submit">
            {isLoading ? 'Suche läuft...' : 'Suchen'}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Fehler</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-solarized-blue border-b-2" />
              <span className="text-solarized-base01">Suche Vorlagen...</span>
            </div>
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-solarized-base03 text-xl">
              Top 3 passende Vorlagen
            </h2>
            {results.map((template, index) => {
              const isFavorited = favouriteStates[template.id];
              const favoriteCount = template._count?.favouriteOf || 0;

              return (
                <div
                  className="rounded-lg border border-solarized-base2 bg-white p-6 shadow-sm"
                  key={template.id}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-solarized-blue/10 px-2 py-1 font-medium text-solarized-blue text-xs">
                          #{index + 1}
                        </span>
                        <span className="rounded bg-solarized-green/10 px-2 py-1 text-solarized-green text-xs">
                          {template.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg text-solarized-base03">
                        {template.title}
                      </h3>
                    </div>
                    <div className="text-right text-sm text-solarized-base01">
                      <div>
                        Übereinstimmung: {Math.round(template.similarity * 100)}
                        %
                      </div>
                      <div className="flex items-center justify-end gap-4">
                        <span>
                          {new Date(template.updatedAt).toLocaleDateString()}
                        </span>
                        {favoriteCount > 0 && (
                          <span className="flex items-center text-muted-foreground text-xs">
                            <StarIcon className="mr-0.5 h-3 w-3" />
                            {formatCount(favoriteCount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 text-sm text-solarized-base02 leading-relaxed">
                    {template.content.length > 200
                      ? `${template.content.slice(0, 200)}...`
                      : template.content}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/templates/${template.id}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Button className="gap-1" size="sm" variant="outline">
                          <ExternalLinkIcon className="h-3 w-3" />
                          Vorlage anzeigen
                        </Button>
                      </Link>

                      {isLoggedIn && (
                        <Button
                          className="gap-1"
                          onClick={() =>
                            handleToggleFavourite(template.id, isFavorited)
                          }
                          size="sm"
                          variant="ghost"
                        >
                          {isFavorited ? (
                            <BookmarkFilledIcon className="h-3 w-3" />
                          ) : (
                            <BookmarkIcon className="h-3 w-3" />
                          )}
                          {isFavorited
                            ? 'Favorit entfernen'
                            : 'Favorit hinzufügen'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Results */}
        {!isLoading && results.length === 0 && query && !error && (
          <div className="text-center text-solarized-base01">
            <p>Keine Vorlagen gefunden, die Ihrer Abfrage entsprechen.</p>
            <p className="text-sm">
              Versuchen Sie es mit anderen Schlüsselwörtern oder Phrasen.
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-solarized-base01">
          <p>
            Versuchen Sie nach Dingen wie "medizinische Entlassungsnotizen",
            "Patientenbewertung" oder "Behandlungspläne" zu suchen, um relevante
            Vorlagen zu finden.
          </p>
        </div>
      </div>
    </div>
  );
}
