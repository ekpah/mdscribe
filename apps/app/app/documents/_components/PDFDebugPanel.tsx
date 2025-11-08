'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { useEffect, useState } from 'react';

interface PDFDebugPanelProps {
  values: Record<string, unknown>;
}

export default function PDFDebugPanel({ values }: PDFDebugPanelProps) {
  const [formattedJson, setFormattedJson] = useState<string>('');

  useEffect(() => {
    // Format JSON with proper indentation
    try {
      const formatted = JSON.stringify(values, null, 2);
      setFormattedJson(formatted);
    } catch (error) {
      console.error('Error formatting JSON:', error);
      setFormattedJson('{}');
    }
  }, [values]);

  // Don't render if there are no values
  if (Object.keys(values).length === 0) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 max-h-96 w-96 overflow-hidden border shadow-lg">
      <div className="flex flex-col">
        <div className="border-b bg-muted/50 px-4 py-2">
          <h4 className="font-semibold text-sm">Form Values</h4>
          <p className="text-muted-foreground text-xs">
            Current form field values
          </p>
        </div>
        <div className="overflow-y-auto p-4">
          <pre className="font-mono text-xs">
            <code className="text-foreground">{formattedJson}</code>
          </pre>
        </div>
      </div>
    </Card>
  );
}

