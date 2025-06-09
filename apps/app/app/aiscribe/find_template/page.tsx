'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { useState } from 'react';

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

interface SearchResponse {
  templates: TemplateSearchResult[];
  count: number;
}

export default function FindTemplatePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TemplateSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/findRelevantTemplate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: SearchResponse = await response.json();

      // Show only top 3 results
      setResults(data.templates.slice(0, 3));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to search templates'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-bold text-3xl text-solarized-base03">
            Find Relevant Templates
          </h1>
          <p className="mt-2 text-solarized-base01">
            Search for templates using natural language queries
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="Describe what kind of template you're looking for..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !query.trim()}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-solarized-blue border-b-2" />
              <span className="text-solarized-base01">
                Searching templates...
              </span>
            </div>
          </div>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-solarized-base03 text-xl">
              Top 3 Matching Templates
            </h2>
            {results.map((template, index) => (
              <div
                key={template.id}
                className="rounded-lg border border-solarized-base2 bg-white p-6 shadow-sm"
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
                    <div>Match: {Math.round(template.similarity * 100)}%</div>
                    <div>
                      {new Date(template.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-solarized-base02 leading-relaxed">
                  {template.content.length > 200
                    ? `${template.content.slice(0, 200)}...`
                    : template.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoading && results.length === 0 && query && !error && (
          <div className="text-center text-solarized-base01">
            <p>No templates found matching your query.</p>
            <p className="text-sm">Try using different keywords or phrases.</p>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 text-center text-sm text-solarized-base01">
          <p>
            Try searching for things like "medical discharge notes", "patient
            assessment", or "treatment plans" to find relevant templates.
          </p>
        </div>
      </div>
    </div>
  );
}
