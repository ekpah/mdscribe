'use client';

import { useChat } from '@ai-sdk/react';
import { eventIteratorToStream } from '@orpc/client';
import type { Template } from '@repo/database';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@repo/design-system/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import z from 'zod';
import { orpc } from '@/lib/orpc';
import { MemoizedCopySection } from '../_components/MemoizedCopySection';

const _ScribeInputSchema = z.object({
  notes: z.string().optional(),
  vordiagnosen: z.string().optional(),
  diagnoseblock: z.string().optional(),
  befunde: z.string().optional(),
  template: z.string(),
});

interface DocumentOutput {
  templateId: string;
  content: string;
  values: Record<string, unknown>;
}

const generateInputsMessage = (
  inputData: string,
  additionalInputData: Record<string, string>,
  templateEdits: Record<string, string>,
  selectedTemplates: Template[]
) => {
  const templateContent =
    selectedTemplates.length > 0
      ? templateEdits[selectedTemplates[0].id] ||
        selectedTemplates[0].content ||
        ''
      : '';

  return `${inputData ? `<notes>${inputData}</notes>` : ''}${
    additionalInputData.vordiagnosen
      ? `<vordiagnosen>${additionalInputData.vordiagnosen}</vordiagnosen>`
      : ''
  }${
    additionalInputData.diagnoseblock
      ? `<diagnoseblock>${additionalInputData.diagnoseblock}</diagnoseblock>`
      : ''
  }${
    additionalInputData.befunde
      ? `<befunde>${additionalInputData.befunde}</befunde>`
      : ''
  }${templateContent ? `<template>${templateContent}</template>` : ''}`;
};

export default function GenerateDocumentation() {
  // State management for the UI
  const [activeTab, setActiveTab] = useState('input');
  const [inputData, setInputData] = useState('');
  const [additionalInputData, setAdditionalInputData] = useState<
    Record<string, string>
  >({});
  const [values, setValues] = useState<Record<string, unknown>>({});

  const { data: favouriteTemplates } = useQuery(
    orpc.user.templates.favourites.queryOptions()
  );

  // Document type selection state
  const [selectedTemplates, setSelectedTemplates] = useState<Template[]>([]);
  const [documentOutputs, setDocumentOutputs] = useState<DocumentOutput[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Template editing state
  const [templateEdits, setTemplateEdits] = useState<Record<string, string>>(
    {}
  );

  // Use Vercel AI SDK's useChat for streaming functionality
  const { messages, sendMessage, status } = useChat({
    transport: {
      // Custom transport that uses orpc for streaming
      async sendMessages(options) {
        return eventIteratorToStream(
          await orpc.scribe.call(
            {
              messages: options.messages,
              chatId: options.chatId,
              body: options.body,
            },
            { signal: options.abortSignal }
          )
        );
      },
      reconnectToStream() {
        throw new Error('Reconnection not supported in this example');
      },
    },
  });

  // Get the latest AI response for display
  const latestAIResponse =
    messages
      .filter((msg) => msg.role === 'assistant')
      .at(-1)
      ?.parts?.map((part) => (part.type === 'text' ? part.text : ''))
      .join('') || '';

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

  // Handle document type selection
  const handleTemplateSelect = (template: Template) => {
    if (!selectedTemplates.includes(template)) {
      setSelectedTemplates((prev) => [...prev, template]);
    }
  };

  // Handle document type removal
  const handleTemplateRemove = (templateToRemove: Template) => {
    setSelectedTemplates((prev) =>
      prev.filter((template) => template !== templateToRemove)
    );
    setDocumentOutputs((prev) =>
      prev.filter((output) => output.templateId !== templateToRemove.id)
    );

    // Remove template edits for this type
    setTemplateEdits((prev) => {
      const newEdits = { ...prev };
      delete newEdits[templateToRemove.id];
      return newEdits;
    });

    // If we're currently on the removed tab, switch to input
    if (activeTab === `output-${templateToRemove.id}`) {
      setActiveTab('input');
    }
  };

  // Handle template editing
  const handleTemplateEdit = (templateId: string, content: string) => {
    setTemplateEdits((prev) => ({
      ...prev,
      [templateId]: content,
    }));
  };

  // Get available templates (not yet selected)
  const getAvailableTemplates = () => {
    return favouriteTemplates?.filter(
      (template) => !selectedTemplates.some((t) => t.id === template.id)
    );
  };

  // Check if all required fields are filled
  const areRequiredFieldsFilled = useCallback(() => {
    return inputData.trim().length > 0 && selectedTemplates.length > 0;
  }, [inputData, selectedTemplates]);

  // Handle form submission to trigger streaming
  const handleGenerate = useCallback(async () => {
    if (!areRequiredFieldsFilled()) {
      toast.error(
        'Bitte geben Sie Patientendaten ein und wählen Sie mindestens einen Dokumenttyp.'
      );
      return;
    }

    setIsGenerating(true);

    // Switch to the first selected document type output tab
    if (selectedTemplates.length > 0) {
      setActiveTab(`output-${selectedTemplates[0].id}`);
    }

    try {
      // Get the template content for the first selected template
      const firstTemplate = selectedTemplates[0];
      const templateContent =
        templateEdits[firstTemplate.id] || firstTemplate.content || '';

      // Prepare body data with only the input fields and template content
      const bodyData = {
        notes: inputData,
        vordiagnosen: additionalInputData.vordiagnosen || '',
        diagnoseblock: additionalInputData.diagnoseblock || '',
        befunde: additionalInputData.befunde || '',
        template: templateContent,
      };

      // Submit the message with input data in the body
      await sendMessage(
        {
          text: generateInputsMessage(
            inputData,
            additionalInputData,
            templateEdits,
            selectedTemplates
          ),
        },
        { body: bodyData }
      );

      toast.success('Generierung gestartet');
    } catch {
      toast.error('Fehler beim Generieren');
      setIsGenerating(false);
    }
  }, [
    inputData,
    selectedTemplates,
    areRequiredFieldsFilled,
    sendMessage,
    templateEdits,
    additionalInputData,
  ]);

  // Update document outputs when AI response changes
  useEffect(() => {
    if (latestAIResponse && selectedTemplates.length > 0) {
      const newOutputs = selectedTemplates.map((template) => ({
        templateId: template.id,
        content: latestAIResponse,
        values,
      }));
      setDocumentOutputs(newOutputs);
      setIsGenerating(false);
    }
  }, [latestAIResponse, selectedTemplates, values]);

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
  const isLoading = status !== 'ready' || isGenerating;

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
                      Notwendige Informationen
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
                    🔒 Alle Daten in dieser Box werden nur lokal gespeichert und
                    niemals an Server übertragen
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
                  <TabsList className="flex w-full justify-start bg-background/50 backdrop-blur-sm">
                    <TabsTrigger
                      className="px-4 py-2 text-sm data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                      value="input"
                    >
                      Eingabe
                    </TabsTrigger>

                    {/* Dynamic output tabs for selected document types */}
                    {selectedTemplates.map((template) => (
                      <TabsTrigger
                        className="relative px-4 py-2 text-sm data-[state=active]:bg-solarized-green data-[state=active]:text-primary-foreground"
                        key={template.id}
                        value={`output-${template.id}`}
                      >
                        {template.title}
                        <Button
                          className="ml-2 h-4 w-4 rounded-full p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTemplateRemove(template);
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </TabsTrigger>
                    ))}

                    {/* Template selector */}
                    {(() => {
                      const availableTemplates = getAvailableTemplates();
                      return availableTemplates &&
                        availableTemplates.length > 0 ? (
                        <div className="ml-2 flex items-center">
                          <Select
                            onValueChange={(templateId) => {
                              const template = favouriteTemplates?.find(
                                (t) => t.id === templateId
                              );
                              if (template) {
                                handleTemplateSelect(template);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-32 items-center justify-center rounded-full border-0 bg-transparent p-0 px-4 hover:bg-accent [&>svg:last-child]:hidden">
                              <Plus className="h-4 w-4" />
                              Template hinzufügen
                            </SelectTrigger>
                            <SelectContent>
                              {availableTemplates.map((template) => (
                                <SelectItem
                                  key={template.id}
                                  value={template.id}
                                >
                                  {template.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null;
                    })()}
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
                      Geben Sie die Patientendaten ein, um eine Dokumentation zu
                      generieren
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Privacy Warning */}
                    <div className="rounded-lg border border-solarized-red/20 bg-solarized-red/10 p-4 text-sm">
                      <p className="text-solarized-red leading-relaxed">
                        ⚠️ <strong>Datenschutzhinweis:</strong> Geben Sie hier
                        keine privaten Patientendaten ein! Diese Informationen
                        werden an eine KI gesendet. Verwenden Sie nur
                        anonymisierte Daten.
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
                          <label
                            className="font-medium text-sm"
                            htmlFor="vordiagnosen"
                          >
                            Vordiagnosen
                          </label>
                          <Textarea
                            className="min-h-[80px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                            disabled={isLoading}
                            id="vordiagnosen"
                            onChange={(e) =>
                              handleAdditionalInputChange(
                                'vordiagnosen',
                                e.target.value
                              )
                            }
                            placeholder="Vordiagnosen eingeben..."
                            value={additionalInputData.vordiagnosen || ''}
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            className="font-medium text-sm"
                            htmlFor="diagnoseblock"
                          >
                            Diagnoseblock
                          </label>
                          <Textarea
                            className="min-h-[80px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                            disabled={isLoading}
                            id="diagnoseblock"
                            onChange={(e) =>
                              handleAdditionalInputChange(
                                'diagnoseblock',
                                e.target.value
                              )
                            }
                            placeholder="Diagnoseblock eingeben..."
                            value={additionalInputData.diagnoseblock || ''}
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            className="font-medium text-sm"
                            htmlFor="befunde"
                          >
                            Befunde
                          </label>
                          <Textarea
                            className="min-h-[80px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                            disabled={isLoading}
                            id="befunde"
                            onChange={(e) =>
                              handleAdditionalInputChange(
                                'befunde',
                                e.target.value
                              )
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

                {/* Dynamic Output Tabs for each selected template */}
                {selectedTemplates.map((template) => (
                  <TabsContent
                    className="space-y-0"
                    key={template.id}
                    value={`output-${template.id}`}
                  >
                    <CardContent>
                      {(() => {
                        const output = documentOutputs.find(
                          (o) => o.templateId === template.id
                        );

                        if (isLoading && !output) {
                          return (
                            <div className="flex flex-col items-center justify-center space-y-4 text-center">
                              <div className="relative">
                                <div className="h-20 w-20 animate-pulse rounded-full border-4 border-solarized-green/20" />
                                <div className="absolute top-0 left-0 h-20 w-20 animate-spin rounded-full border-4 border-solarized-green border-t-transparent" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="font-semibold text-foreground text-lg">
                                  Wird generiert...
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                  Bitte warten Sie, während der KI-Assistent
                                  Ihre {template.title} erstellt
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (output) {
                          return (
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <h4 className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                  <div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
                                  Generierte {template.title}
                                </h4>
                                <ScrollArea className="h-[calc(100vh-400px)] rounded-lg border border-solarized-green/20 bg-background/50 p-6">
                                  <MemoizedCopySection
                                    content={
                                      output.content ||
                                      'Keine Inhalte verfügbar'
                                    }
                                    values={output.values}
                                  />
                                </ScrollArea>
                              </div>

                              {isLoading && (
                                <div className="flex items-center justify-center gap-2 text-sm text-solarized-green">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Wird weiter generiert...</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h4 className="flex items-center gap-2 font-semibold text-foreground text-sm">
                                <div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
                                Template für {template.title}
                              </h4>
                              <div className="space-y-3">
                                <p className="text-muted-foreground text-sm">
                                  Bearbeiten Sie das Template, um die
                                  KI-Anweisungen anzupassen:
                                </p>
                                <Textarea
                                  className="min-h-[300px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-green focus:ring-solarized-green/20"
                                  onChange={(e) =>
                                    handleTemplateEdit(
                                      template.id,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Template bearbeiten..."
                                  value={
                                    templateEdits[template.id] ||
                                    template.content ||
                                    ''
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-muted-foreground text-xs">
                                  Das Template wird bei der Generierung
                                  verwendet
                                </p>
                                <Button
                                  onClick={() => setActiveTab('input')}
                                  size="sm"
                                  variant="outline"
                                >
                                  Zu Eingabe wechseln
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </TabsContent>
                ))}
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
