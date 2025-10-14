'use client';

import { useCompletion } from '@ai-sdk/react';
import {
  PromptInput,
  PromptInputActionMenu,
  PromptInputBody,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@repo/design-system/components/ai-elements/prompt-input';
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
import { Input } from '@repo/design-system/components/ui/input';
import { Kbd } from '@repo/design-system/components/ui/kbd';
import { Label } from '@repo/design-system/components/ui/label';
import { ScrollArea } from '@repo/design-system/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { FileText, Loader2, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MemoizedCopySection } from './MemoizedCopySection';

interface AdditionalInputField {
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: 'text' | 'textarea';
  description?: string;
}

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

  // Additional input fields
  additionalInputs?: AdditionalInputField[];

  // Button text
  generateButtonText: string;
  regenerateButtonText: string;

  // Empty state messages
  emptyStateTitle: string;
  emptyStateDescription: string;

  // Optional custom processing
  customPromptProcessor?: (
    inputData: string,
    additionalInputs: Record<string, string>
  ) => Record<string, unknown>;
  customApiCall?: (
    inputData: string,
    additionalInputs: Record<string, string>
  ) => Promise<unknown>;
}
const models = [
  { id: 'auto', name: 'Auto' },
  { id: 'glm-4p5', name: 'GLM-4.5' },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
];

const getActualModel = (modelId: string): string => {
  if (modelId === 'auto') {
    return 'claude-sonnet-4.5';
  }
  return modelId;
};

interface AiscribeTemplateProps {
  config: AiscribeTemplateConfig;
}

export function AiscribeTemplate({ config }: AiscribeTemplateProps) {
  const [activeTab, setActiveTab] = useState('input');
  const [inputData, setInputData] = useState('');
  const [additionalInputData, setAdditionalInputData] = useState<
    Record<string, string>
  >({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [model, setModel] = useState<string>(models[0].id);

  // Use Vercel AI SDK's useCompletion
  const completion = useCompletion({
    api: config.apiEndpoint,
    body: {
      model: getActualModel(model),
    },
  });

  // Combined loading state
  const isLoading = completion.isLoading || isGenerating;

  // Handle values change from inputs
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
    if (!inputData.trim()) {
      return false;
    }

    if (config.additionalInputs) {
      return config.additionalInputs.every(
        (field) =>
          !field.required ||
          (additionalInputData[field.name] &&
            additionalInputData[field.name].trim())
      );
    }

    return true;
  }, [inputData, additionalInputData, config.additionalInputs]);

  const handleGenerate = useCallback(async () => {
    if (!areRequiredFieldsFilled()) {
      toast.error('Bitte füllen Sie alle erforderlichen Felder aus.');
      return;
    }

    setIsGenerating(true);
    setActiveTab('output');

    try {
      // Handle custom API call if provided
      if (config.customApiCall) {
        await config.customApiCall(inputData, additionalInputData);
      }

      // Prepare prompt
      const prompt = config.customPromptProcessor
        ? config.customPromptProcessor(inputData, additionalInputData)
        : JSON.stringify({
            [config.inputFieldName]: inputData,
            ...additionalInputData,
          });

      await completion.complete(
        typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
        {
          body: {
            model: getActualModel(model),
          },
        }
      );

      // Check for errors after completion
      if (completion.error) {
        toast.error(completion.error.message || 'Fehler beim Generieren');
      } else if (completion.completion) {
        toast.success('Erfolgreich generiert');
      }
    } catch {
      toast.error('Fehler beim Generieren');
    } finally {
      setIsGenerating(false);
    }
  }, [
    inputData,
    additionalInputData,
    areRequiredFieldsFilled,
    completion.complete,
    completion.error,
    completion.completion,
    config.customApiCall,
    config.customPromptProcessor,
    config.inputFieldName,
    model,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '1') {
        e.preventDefault();
        document.getElementById('input-field')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading && areRequiredFieldsFilled()) {
          handleGenerate();
        }
      }
    },
    [isLoading, areRequiredFieldsFilled, handleGenerate]
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
                  <TabsList className="grid grid-cols-2 bg-background/50 backdrop-blur-sm">
                    <TabsTrigger
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                      value="input"
                    >
                      {config.inputTabTitle}
                    </TabsTrigger>
                    <TabsTrigger
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                      value="output"
                    >
                      {config.outputTabTitle}
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* Input Tab */}
                <TabsContent className="space-y-0" value="input">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <FileText className="h-5 w-5 text-solarized-blue" />
                      {config.inputTabTitle}
                    </CardTitle>
                    <CardDescription>{config.inputDescription}</CardDescription>
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
                    {config.additionalInputs &&
                      config.additionalInputs.length > 0 && (
                        <div className="space-y-4 rounded-lg border border-solarized-blue/20 bg-solarized-blue/5 p-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-solarized-blue" />
                            <h4 className="font-medium text-foreground text-sm">
                              Zusätzliche Informationen
                            </h4>
                          </div>
                          <div className="grid gap-4">
                            {config.additionalInputs.map((field) => (
                              <div className="space-y-2" key={field.name}>
                                <Label
                                  className="font-medium text-sm"
                                  htmlFor={field.name}
                                >
                                  {field.label}
                                  {field.required && (
                                    <span className="ml-1 text-red-500">*</span>
                                  )}
                                </Label>
                                {field.type === 'textarea' ? (
                                  <Textarea
                                    className="min-h-[100px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                                    disabled={isLoading}
                                    id={field.name}
                                    onChange={(e) =>
                                      handleAdditionalInputChange(
                                        field.name,
                                        e.target.value
                                      )
                                    }
                                    placeholder={field.placeholder}
                                    value={
                                      additionalInputData[field.name] || ''
                                    }
                                  />
                                ) : (
                                  <Input
                                    className="border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                                    disabled={isLoading}
                                    id={field.name}
                                    onChange={(e) =>
                                      handleAdditionalInputChange(
                                        field.name,
                                        e.target.value
                                      )
                                    }
                                    placeholder={field.placeholder}
                                    value={
                                      additionalInputData[field.name] || ''
                                    }
                                  />
                                )}
                                {field.description && (
                                  <p className="text-muted-foreground text-xs">
                                    {field.description}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Main Input Field */}
                    <PromptInput onSubmit={handleGenerate}>
                      <PromptInputBody>
                        <PromptInputTextarea
                          className="min-h-[400px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                          disabled={isLoading}
                          id="input-field"
                          onChange={(e) => setInputData(e.target.value)}
                          placeholder={config.inputPlaceholder}
                          value={inputData}
                        />
                      </PromptInputBody>
                      <PromptInputToolbar>
                        <PromptInputTools>
                          <PromptInputActionMenu>
                            <PromptInputModelSelect
                              onValueChange={(value) => {
                                setModel(value);
                              }}
                              value={model}
                            >
                              <PromptInputModelSelectTrigger>
                                <PromptInputModelSelectValue />
                              </PromptInputModelSelectTrigger>
                              <PromptInputModelSelectContent>
                                {models.map((m) => (
                                  <PromptInputModelSelectItem
                                    key={m.id}
                                    value={m.id}
                                  >
                                    {m.name}
                                  </PromptInputModelSelectItem>
                                ))}
                              </PromptInputModelSelectContent>
                            </PromptInputModelSelect>
                          </PromptInputActionMenu>
                        </PromptInputTools>
                        <PromptInputSubmit
                          disabled={isLoading || !areRequiredFieldsFilled()}
                        />
                      </PromptInputToolbar>
                    </PromptInput>
                  </CardContent>
                  <CardFooter className="flex items-center justify-center bg-muted/20">
                    <div className="flex items-center gap-6 text-muted-foreground text-sm">
                      <div className="flex items-center gap-2">
                        <Kbd>⌘⇧1</Kbd>
                        <span>für Fokus</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Kbd>⌘↵</Kbd>
                        <span>zum Generieren</span>
                      </div>
                    </div>
                  </CardFooter>
                </TabsContent>

                {/* Output Tab */}
                <TabsContent className="space-y-0" value="output">
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
                                  content={
                                    completion.completion ||
                                    'Keine Inhalte verfügbar'
                                  }
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
                              {config.emptyStateTitle}
                            </h3>
                            <p className="max-w-md text-sm">
                              {config.emptyStateDescription}
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
                  {/* <CardFooter className="flex items-center justify-between bg-muted/20">
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
                  </CardFooter> */}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
