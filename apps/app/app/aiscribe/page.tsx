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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MemoizedMarkdown } from './_components/memoized-markdown';

export default function AITextGenerator() {
  const [diagnosisInput, setDiagnosisInput] = useState<string>('');
  const [anamneseInput, setAnamneseInput] = useState<string>('');
  const { completion, complete, isLoading } = useCompletion({
    api: '/api/scribe',
    experimental_throttle: 50,
    onError: (error: Error) => {
      console.log('errormessage', error, error.message);
      toast.error(`Fehler beim Generieren der Anamnese: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const prompt = JSON.stringify({
      vordiagnosen: diagnosisInput,
      anamnese: anamneseInput,
    });
    complete(prompt);
  };

  return (
    <div className="mx-auto flex h-4/5 w-4/5 flex-col gap-4 space-y-4 md:flex-row">
      <Card className="flex h-full flex-col md:w-1/2">
        <CardHeader>
          <CardTitle>Stichpunkte</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <span className="text-muted-foreground text-sm">
            Geben Sie hier Ihre Stichpunkte ein. Basierend darauf wird eine
            kurze Anamnese generiert.
          </span>
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <Tabs defaultValue="vordiagnosen" className="flex flex-1 flex-col">
              <TabsList className="justify-start border-muted border-b bg-muted/50">
                <TabsTrigger
                  value="vordiagnosen"
                  className="rounded-none data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:bg-background"
                >
                  Vordiagnosen
                </TabsTrigger>
                <TabsTrigger
                  value="anamnese"
                  className="rounded-none data-[state=active]:border-primary data-[state=active]:border-b-2 data-[state=active]:bg-background"
                >
                  Anamnese
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="vordiagnosen"
                className="flex-1 rounded-md border"
              >
                <Textarea
                  value={diagnosisInput}
                  onChange={(e) => setDiagnosisInput(e.target.value)}
                  placeholder="Geben Sie hier Ihre Vordiagnosen ein..."
                  className="h-full min-h-[300px] resize-none border-none"
                />
              </TabsContent>
              <TabsContent
                value="anamnese"
                className="flex-1 rounded-md border"
              >
                <Textarea
                  value={anamneseInput}
                  onChange={(e) => setAnamneseInput(e.target.value)}
                  placeholder="Geben Sie hier Ihre Anamnese ein..."
                  className="h-full min-h-[300px] resize-none border-none"
                />
              </TabsContent>
            </Tabs>
            <Button type="submit" disabled={isLoading} className="mt-4">
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
      <Card className="flex h-full w-full flex-col overflow-y-auto md:w-1/2">
        <CardHeader className="flex-none">
          <CardTitle>{'Anamnese'}</CardTitle>
          {false && (
            <Accordion type="single" collapsible>
              <AccordionItem value="analysis">
                <AccordionTrigger className="text-sm">Analyse</AccordionTrigger>
                <AccordionContent>
                  <MemoizedMarkdown
                    content={completion.split('<anamnese>')[0] || ''}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {completion && (
            <Accordion type="single" collapsible>
              <AccordionItem value="diagnoseblock">
                <AccordionTrigger className="text-sm">
                  Diagnoseblock
                </AccordionTrigger>
                <AccordionContent>
                  <MemoizedMarkdown
                    content={
                      completion
                        .split('<diagnoseblock>')[1]
                        ?.split('</diagnoseblock>')[0] || ''
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {completion && (
            <MemoizedMarkdown
              content={
                completion.split('<anamnese>')[1]?.split('</anamnese>')[0] || ''
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
