'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { ScrollArea } from '@repo/design-system/components/ui/scroll-area';
import { Check, Copy, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface TransferSummarySectionProps {
  isGenerating: boolean;
  summary: string | undefined;
  onGenerate: () => void;
  hasData: boolean;
  onSwitchToNotes: () => void;
}

export function TransferSummarySection({
  isGenerating,
  summary,
  onGenerate,
  hasData,
  onSwitchToNotes,
}: TransferSummarySectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!summary) return;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success('Zusammenfassung kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Fehler beim Kopieren');
      console.error('Copy error:', error);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-foreground">
          ICU-Aufenthalt Zusammenfassung
        </CardTitle>
        <CardDescription>
          Zusammenfassung des Patientenzustands für die Verlegung auf die
          Normalstation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary ? (
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="whitespace-pre-wrap text-foreground">{summary}</div>
          </ScrollArea>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
            <FileText className="mb-2 h-12 w-12" />
            <p>
              Keine Zusammenfassung verfügbar. Bitte generieren Sie zuerst eine
              Zusammenfassung aus den Patientennotizen.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={onSwitchToNotes}
            >
              Zu Notizen wechseln
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" disabled={!summary}>
          Als PDF exportieren
        </Button>
        <div className="flex gap-2">
          {summary && (
            <Button
              variant="outline"
              onClick={handleCopy}
              className="border-solarized-blue text-solarized-blue hover:bg-solarized-blue/10"
            >
              {copied ? (
                <>
                  <Check className="mr-2 size-4" />
                  Kopiert
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" />
                  Kopieren
                </>
              )}
            </Button>
          )}
          <Button
            onClick={onGenerate}
            disabled={isGenerating || !hasData}
            className="bg-solarized-green text-solarized-base3 hover:bg-solarized-green/90"
          >
            <Check className="mr-2 size-4" />
            Verlegungsnotiz erstellen
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
