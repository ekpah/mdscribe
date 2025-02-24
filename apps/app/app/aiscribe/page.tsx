'use client';
import { useCompletion } from '@ai-sdk/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/design-system/components/ui/accordion';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MemoizedMarkdown } from './_components/memoized-markdown';
export default function AITextGenerator() {
  const { completion, complete } = useCompletion({
    api: '/api/scribe',
    onError: (error: Error) => {
      console.log('errormessage', error, error.message);
      toast.error(`Fehler beim Generieren der Anamnese: ${error.message}`);
      setIsLoading(false);
    },
    onFinish: () => {
      console.log(completion);
      setIsLoading(false);
    },
  });
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<string>('');
  return (
    <div className="mx-auto flex h-4/5 w-4/5 flex-col gap-4 space-y-4 md:flex-row">
      <Card className="h-full md:w-1/2">
        <CardHeader>
          <CardTitle>Stichpunkte</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="mb-4 text-muted-foreground text-sm">
            Geben Sie hier Ihre Stichpunkte ein. Basierend darauf wird eine
            kurze Anamnese generiert.
          </span>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              await complete(notes);
            }}
          >
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Geben Sie hier Ihre Stichpunkte ein..."
              className="mb-4 h-[200px]"
            />
            <Button type="submit" disabled={isLoading}>
              Generieren
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* <Card>
          <CardHeader>
            <CardTitle>Adjust Output</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdjustment}>
              <Textarea
                value={adjustmentPrompt}
                onChange={(e) => setAdjustmentPrompt(e.target.value)}
                placeholder="Adjust the output..."
                className="mb-4"
              />
              <Button type="submit" disabled={isLoading}>
                Adjust Output
              </Button>
            </form>
          </CardContent>
        </Card> */}
      <Card className="w-full md:w-1/2">
        <CardHeader>
          <CardTitle>Anamnese</CardTitle>

          {completion && (
            <Accordion type="single" collapsible>
              <AccordionItem value="analysis">
                <AccordionTrigger className="text-sm">Analyse</AccordionTrigger>
                <AccordionContent>
                  <MemoizedMarkdown
                    content={
                      completion.split('</analyse_und_kategorisierung>')[0]
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardHeader>
        <CardContent className="h-full overflow-auto">
          {completion && (
            <MemoizedMarkdown
              content={
                completion.split('</analyse_und_kategorisierung>')[1] || ''
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
