'use client';

import { useChat } from '@ai-sdk/react';
import { eventIteratorToStream } from '@orpc/client';
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
import { FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { orpc } from '@/lib/orpc';
import { MemoizedCopySection } from '../_components/MemoizedCopySection';

export default function GenerateDocumentation() {
  // State management for the UI
  const [activeTab, setActiveTab] = useState('input');
  const [inputData, setInputData] = useState('');
  const [additionalInputData, setAdditionalInputData] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});

  // Use Vercel AI SDK's useChat for streaming functionality
  const { messages, sendMessage, status } = useChat({
    transport: {
      // Custom transport that uses orpc for streaming
      async sendMessages() {
        // Extract data from the message and additional inputs
        const requestData = {
          anamnese: inputData || 'Anamnese nicht vorliegend.',
          vordiagnosen: additionalInputData.vordiagnosen || 'Keine Vordiagnosen.',
          diagnoseblock: additionalInputData.diagnoseblock || 'Leerer Diagnoseblock.',
          befunde: additionalInputData.befunde || 'Keine Befunde.',
        };

        // Call the orpc router and convert the response to a stream
        return eventIteratorToStream(
          await orpc.scribe.call(requestData)
        );
      },
      reconnectToStream() {
        throw new Error('Reconnection not supported in this example');
      },
    },
  });

  // Get the latest AI response for display
  const latestAIResponse = messages
    .filter(msg => msg.role === 'assistant')
    .at(-1)?.parts?.map(part => part.type === 'text' ? part.text : '').join('') || '';

  // Handle values change from the extracted inputs
  const handleValuesChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  // Handle additional input changes
  const handleAdditionalInputChange = (name: string, value: string) => {
    setAdditionalInputData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Check if all required fields are filled
  const areRequiredFieldsFilled = useCallback(() => {
    return inputData.trim().length > 0;
  }, [inputData]);

  // Handle form submission to trigger streaming
  const handleGenerate = useCallback(async () => {
    if (!areRequiredFieldsFilled()) {
      toast.error('Bitte geben Sie Patientendaten ein.');
      return;
    }

    setActiveTab('output');

    try {
      // Send the message to trigger the streaming response
      await sendMessage({
        text: `Generate documentation for: ${inputData}`
      });

      toast.success('Generierung gestartet');
    } catch {
      toast.error('Fehler beim Generieren');
    }
  }, [inputData, areRequiredFieldsFilled, sendMessage]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd+Shift+1 to focus input field
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '1') {
        e.preventDefault();
        document.getElementById('input-field')?.focus();
      }
      // Cmd+Enter to generate
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (status === 'ready' && areRequiredFieldsFilled()) {
          handleGenerate();
        }
      }
    },
    [status, areRequiredFieldsFilled, handleGenerate]
  );

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Loading state
  const isLoading = status !== 'ready';

  return (
    <div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-full bg-solarized-blue/10 p-3">
              <FileText className="h-8 w-8 text-solarized-blue" />
            </div>
            <div>
              <h1 className="font-bold text-3xl text-primary">
                Klinische Dokumentation
              </h1>
              <p className="text-lg text-muted-foreground">
                Erstelle aus den Patientendaten eine Dokumentation.
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
                      Extrahierte Informationen
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {/* Auto-extracted information from the AI response */}
                <div className="pt-6">
                  {latestAIResponse && (
                    <div className="space-y-3">
                      <Inputs
                        inputTags={parseMarkdocToInputs(latestAIResponse)}
                        onChange={handleValuesChange}
                      />
                    </div>
                  )}

                  {!latestAIResponse && (
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
                    🔒 Alle Daten in dieser Box werden nur lokal gespeichert und niemals an
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
                className="w-full"
                onValueChange={setActiveTab}
                value={activeTab}
              >
                <CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
                  <TabsList className="grid grid-cols-2 bg-background/50 backdrop-blur-sm">
                    <TabsTrigger
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                      value="input"
                    >
                      Eingabe
                    </TabsTrigger>
                    <TabsTrigger
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                      value="output"
                    >
                      Ausgabe
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* Input Tab */}
                <TabsContent className="space-y-0" value="input">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <FileText className="h-5 w-5 text-solarized-blue" />
                      Patientendaten
                    </CardTitle>
                    <CardDescription>
                      Geben Sie die Patientendaten ein, um eine Dokumentation zu generieren
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Privacy Warning */}
                    <div className="rounded-lg border border-solarized-red/20 bg-solarized-red/10 p-4 text-sm">
                      <p className="text-solarized-red leading-relaxed">
                        ⚠️ <strong>Datenschutzhinweis:</strong> Geben Sie hier keine privaten Patientendaten ein! Diese Informationen werden an eine KI gesendet. Verwenden Sie nur anonymisierte Daten.
                      </p>
                    </div>

                    {/* Additional Input Fields */}
                    <div className="space-y-4 rounded-lg border border-solarized-blue/20 bg-solarized-blue/5 p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-solarized-blue" />
                        <h4 className="font-medium text-foreground text-sm">
                          Zusätzliche Informationen
                        </h4>
                      </div>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <label className="font-medium text-sm" htmlFor="vordiagnosen">
                            Vordiagnosen
                          </label>
                          <Textarea
                            className="min-h-[80px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                            disabled={isLoading}
                            id="vordiagnosen"
                            onChange={(e) =>
                              handleAdditionalInputChange('vordiagnosen', e.target.value)
                            }
                            placeholder="Vordiagnosen eingeben..."
                            value={additionalInputData.vordiagnosen || ''}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="font-medium text-sm" htmlFor="diagnoseblock">
                            Diagnoseblock
                          </label>
                          <Textarea
                            className="min-h-[80px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                            disabled={isLoading}
                            id="diagnoseblock"
                            onChange={(e) =>
                              handleAdditionalInputChange('diagnoseblock', e.target.value)
                            }
                            placeholder="Diagnoseblock eingeben..."
                            value={additionalInputData.diagnoseblock || ''}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="font-medium text-sm" htmlFor="befunde">
                            Befunde
                          </label>
                          <Textarea
                            className="min-h-[80px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                            disabled={isLoading}
                            id="befunde"
                            onChange={(e) =>
                              handleAdditionalInputChange('befunde', e.target.value)
                            }
                            placeholder="Befunde eingeben..."
                            value={additionalInputData.befunde || ''}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Main Input Field */}
                    <Textarea
                      className="min-h-[400px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                      disabled={isLoading}
                      id="input-field"
                      onChange={(e) => setInputData(e.target.value)}
                      placeholder="Geben Sie hier die Anamnese oder Patientendaten ein..."
                      value={inputData}
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
                      className="bg-solarized-blue text-primary-foreground shadow-lg transition-all hover:bg-solarized-blue/90"
                      disabled={isLoading || !areRequiredFieldsFilled()}
                      onClick={handleGenerate}
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
                          Dokumentation generieren
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </TabsContent>

                {/* Output Tab */}
                <TabsContent className="space-y-0" value="output">
                  <CardContent>
                    {(() => {
                      if (isLoading && !latestAIResponse) {
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
                                Bitte warten Sie, während der KI-Assistent Ihre
                                Dokumentation erstellt
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (latestAIResponse) {
                        return (
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h4 className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                <div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
                                Generierte Dokumentation
                              </h4>
                              <ScrollArea className="h-[calc(100vh-400px)] rounded-lg border border-solarized-green/20 bg-background/50 p-6">
                                <MemoizedCopySection
                                  content={latestAIResponse || 'Keine Inhalte verfügbar'}
                                  values={values}
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
                              Keine Dokumentation verfügbar
                            </h3>
                            <p className="max-w-md text-sm">
                              Geben Sie Patientendaten ein und generieren Sie eine neue Dokumentation
                            </p>
                            <Button
                              className="mt-4"
                              onClick={() => setActiveTab('input')}
                              variant="outline"
                            >
                              Zu Eingabe wechseln
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
