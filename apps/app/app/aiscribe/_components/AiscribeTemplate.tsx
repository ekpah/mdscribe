'use client';

import { useCompletion } from '@ai-sdk/react';
import Inputs from '@repo/design-system/components/inputs/Inputs';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { Check, Copy, FileText, Loader2, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MemoizedCopySection } from './MemoizedCopySection';

export interface AiscribeTemplateConfig {
  // Page identity
  title: string;
  description: string;
  icon: LucideIcon;

  // API configuration
  apiEndpoint: string;

  // Tab configuration
  inputTabTitle: string;
  outputTabTitle: string;

  // Form configuration
  inputFieldName: string;
  inputPlaceholder: string;
  inputDescription: string;

  // Button text
  generateButtonText: string;
  regenerateButtonText: string;

  // Empty state messages
  emptyStateTitle: string;
  emptyStateDescription: string;

  // Optional custom processing
  customPromptProcessor?: (inputData: string) => Record<string, unknown>;
  customApiCall?: (inputData: string) => Promise<unknown>;
}

interface AiscribeTemplateProps {
  config: AiscribeTemplateConfig;
}

export function AiscribeTemplate({ config }: AiscribeTemplateProps) {
  const [activeTab, setActiveTab] = useState('input');
  const [inputData, setInputData] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [customApiResult, setCustomApiResult] = useState<unknown>(null);

  // Use Vercel AI SDK's useCompletion
  const completion = useCompletion({
    api: config.apiEndpoint,
  });

  // Combined loading state
  const isLoading = completion.isLoading || isGenerating;

  // Handle values change from inputs
  const handleValuesChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  const handleGenerate = useCallback(async () => {
    if (!inputData.trim()) {
      toast.error('Bitte geben Sie die erforderlichen Informationen ein.');
      return;
    }

    setIsGenerating(true);
    setActiveTab('output');

    try {
      // Handle custom API call if provided
      if (config.customApiCall) {
        const customResult = await config.customApiCall(inputData);
        setCustomApiResult(customResult);
      }

      // Prepare prompt
      const prompt = config.customPromptProcessor
        ? config.customPromptProcessor(inputData)
        : JSON.stringify({ [config.inputFieldName]: inputData });

      await completion.complete(
        typeof prompt === 'string' ? prompt : JSON.stringify(prompt)
      );

      // Check for errors after completion
      if (completion.error) {
        console.error('Generation error:', completion.error);
        toast.error('Fehler beim Generieren');
      } else if (completion.completion) {
        toast.success('Erfolgreich generiert');
      }
    } catch (err) {
      toast.error('Fehler beim Generieren');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    inputData,
    completion.complete,
    completion.error,
    completion.completion,
    config.customApiCall,
    config.customPromptProcessor,
    config.inputFieldName,
  ]);

  const handleCopy = async () => {
    if (!completion.completion) return;

    try {
      await navigator.clipboard.writeText(completion.completion);
      setCopied(true);
      toast.success('Inhalt kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Fehler beim Kopieren');
      console.error('Copy error:', error);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '1') {
        e.preventDefault();
        document.getElementById('input-field')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading && inputData.trim()) {
          handleGenerate();
        }
      }
    },
    [isLoading, inputData, handleGenerate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const IconComponent = config.icon;

  return (
    <div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-full bg-solarized-blue/10 p-3">
              <IconComponent className="h-8 w-8 text-solarized-blue" />
            </div>
            <div>
              <h1 className="font-bold text-3xl text-primary">
                {config.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 xl:grid-cols-6">
          {/* Patient Info Card */}
          <div className="lg:col-span-2 xl:col-span-2">
            <Card className="h-fit border-solarized-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-green/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-solarized-blue" />
                    <CardTitle className="text-base text-foreground">
                      Patienteninformationen
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {/* Auto-extracted information and Input Fields */}
                <div className="pt-6">
                  {/* Input Fields from Markdoc */}
                  {completion.completion && (
                    <div className="space-y-3">
                      <Inputs
                        inputTags={parseMarkdocToInputs(
                          completion.completion || ''
                        )}
                        onChange={handleValuesChange}
                      />
                    </div>
                  )}

                  {(!completion.completion ||
                    parseMarkdocToInputs(completion.completion).length ===
                      0) && (
                    <div className="rounded-lg border border-muted-foreground/20 border-dashed bg-muted/20 p-4 text-center">
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Notwendige Informationen werden automatisch aus den
                        Eingaben extrahiert
                      </p>
                    </div>
                  )}
                </div>

                {/* Privacy notice */}
                <div className="rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-4 text-xs">
                  <p className="text-solarized-green leading-relaxed">
                    🔒 Alle Daten werden nur lokal gespeichert und niemals an
                    Server übertragen
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content with Tabs */}
          <div className="lg:col-span-3 xl:col-span-4">
            <Card className="border-solarized-green/20 shadow-lg">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
                  <TabsList className="grid grid-cols-2 bg-background/50 backdrop-blur-sm">
                    <TabsTrigger
                      value="input"
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                    >
                      {config.inputTabTitle}
                    </TabsTrigger>
                    <TabsTrigger
                      value="output"
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                    >
                      {config.outputTabTitle}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* Input Tab */}
                <TabsContent value="input" className="space-y-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <FileText className="h-5 w-5 text-solarized-blue" />
                      {config.inputTabTitle}
                    </CardTitle>
                    <CardDescription>{config.inputDescription}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      id="input-field"
                      placeholder={config.inputPlaceholder}
                      className="min-h-[400px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                      value={inputData}
                      onChange={(e) => setInputData(e.target.value)}
                      disabled={isLoading}
                    />
                  </CardContent>
                  <CardFooter className="flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-6 text-muted-foreground text-sm">
                      <div className="flex items-center gap-2">
                        <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                          ⌘⇧1
                        </kbd>
                        <span>für Fokus</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                          ⌘↵
                        </kbd>
                        <span>zum Generieren</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleGenerate}
                      disabled={isLoading || !inputData.trim()}
                      className="bg-solarized-blue text-primary-foreground shadow-lg transition-all hover:bg-solarized-blue/90"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Generiere...
                        </>
                      ) : (
                        <>
                          <FileText className="mr-2 size-4" />
                          {config.generateButtonText}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </TabsContent>

                {/* Output Tab */}
                <TabsContent value="output" className="space-y-0">
                  <CardContent>
                    {(() => {
                      if (isLoading && !completion.completion) {
                        return (
                          <div className="flex flex-col items-center justify-center space-y-4 text-center">
                            <div className="relative">
                              <div className="h-20 w-20 animate-pulse rounded-full border-4 border-solarized-blue/20" />
                              <div className="absolute top-0 left-0 h-20 w-20 animate-spin rounded-full border-4 border-solarized-blue border-t-transparent" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="font-semibold text-foreground text-lg">
                                Wird generiert...
                              </h3>
                              <p className="text-muted-foreground text-sm">
                                Bitte warten Sie, während der KI-Assistent Ihren
                                Inhalt erstellt
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (completion.completion) {
                        return (
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h4 className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                <div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
                                {config.outputTabTitle}
                              </h4>
                              <ScrollArea className="h-[calc(100vh-400px)] rounded-lg border border-solarized-green/20 bg-background/50 p-6">
                                <MemoizedCopySection
                                  values={values}
                                  content={
                                    completion.completion ||
                                    'Keine Inhalte verfügbar'
                                  }
                                />
                              </ScrollArea>
                            </div>

                            {isLoading && (
                              <div className="flex items-center justify-center gap-2 text-sm text-solarized-blue">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Wird weiter generiert...</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                          <div className="rounded-full bg-muted/20 p-6">
                            <FileText className="h-16 w-16" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lg">
                              {config.emptyStateTitle}
                            </h3>
                            <p className="max-w-md text-sm">
                              {config.emptyStateDescription}
                            </p>
                            <Button
                              variant="outline"
                              className="mt-4"
                              onClick={() => setActiveTab('input')}
                            >
                              Zu Eingabe wechseln
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between bg-muted/20">
                    <Button
                      variant="outline"
                      disabled={!completion.completion}
                      className="shadow-sm"
                    >
                      Exportieren
                    </Button>
                    <div className="flex gap-3">
                      {completion.completion && (
                        <Button
                          variant="outline"
                          onClick={handleCopy}
                          className="border-solarized-blue shadow-sm transition-all hover:bg-solarized-blue/10"
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
                        onClick={handleGenerate}
                        disabled={isLoading || !inputData.trim()}
                        className="bg-solarized-green shadow-lg transition-all hover:bg-solarized-green/90"
                      >
                        <FileText className="mr-2 size-4" />
                        {config.regenerateButtonText}
                      </Button>
                    </div>
                  </CardFooter>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
