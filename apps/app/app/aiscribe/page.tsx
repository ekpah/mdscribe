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

const { XMLParser, XMLBuilder, XMLValidator } = require('fast-xml-parser');

type FinalCompletion = {
  diagnose?: string;
  analyse?: string;
  kategorisierung?: string;
  anamnese?: string;
};

export default function AITextGenerator() {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
  });
  const [finalCompletion, setFinalCompletion] = useState<FinalCompletion>({});
  const { completion, complete } = useCompletion({
    api: '/api/scribe',
    onError: (error: Error) => {
      console.log('errormessage', error, error.message);
      toast.error(`Fehler beim Generieren der Anamnese: ${error.message}`);
      setIsLoading(false);
    },
    onFinish: () => {
      const parsedCompletion = parser.parse(`<analyse>${completion}`.trim());
      const data =
        typeof parsedCompletion === 'string'
          ? JSON.parse(parsedCompletion)
          : parsedCompletion;
      setFinalCompletion({
        diagnose: data.diagnose,
        analyse: data.analyse,
        kategorisierung: data.kategorisierung,
        anamnese: data.anamnese,
      });
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
      <Card className="flex h-full w-full flex-col md:w-1/2">
        <CardHeader className="flex-none">
          <CardTitle>
            {finalCompletion.diagnose ? finalCompletion.diagnose : 'Anamnese'}
          </CardTitle>

          {completion && (
            <Accordion type="single" collapsible>
              <AccordionItem value="analysis">
                <AccordionTrigger className="text-sm">Analyse</AccordionTrigger>
                <AccordionContent>
                  <MemoizedMarkdown
                    content={
                      finalCompletion.analyse
                        ? finalCompletion.analyse
                        : completion.split('<anamnese>')[0]
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {completion && (
            <MemoizedMarkdown
              content={
                finalCompletion.anamnese
                  ? finalCompletion.anamnese
                  : completion.split('<anamnese>')[1] || ''
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
