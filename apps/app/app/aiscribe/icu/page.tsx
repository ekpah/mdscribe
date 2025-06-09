'use client';

import parseMarkdocToInputs from '@/lib/parseMarkdocToInputs';
import { useCompletion } from '@ai-sdk/react';
import { Badge } from '@repo/design-system/components/ui/badge';
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
import { Label } from '@repo/design-system/components/ui/label';
import { ScrollArea } from '@repo/design-system/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import Inputs from '@repo/markdoc-md/render/inputs/Inputs';
import { Check, Copy, FileText, Loader2, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { MemoizedCopySection } from '../_components/MemoizedCopySection';

interface PatientInfo {
  name: string;
  gender: string;
  diagnosis?: string;
  status?: string;
  extractedInfo?: {
    age?: string;
    room?: string;
    doctor?: string;
    admissionDate?: string;
  };
}

export default function ICUPage() {
  const [activeTab, setActiveTab] = useState('notizen');
  const [patientNotes, setPatientNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});

  // Patient info state
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    gender: '',
  });

  // Use Vercel AI SDK's useCompletion for ICU transfer
  const completedTransfer = useCompletion({
    api: '/api/scribe/icu/transfer/stream',
  });

  // Combined loading state
  const isLoading = completedTransfer.isLoading || isGenerating;

  // Handle values change from inputs
  const handleValuesChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  // Load patient info from localStorage
  useEffect(() => {
    const savedInfo = localStorage.getItem('icu-patient-info');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        setPatientInfo(parsed);
      } catch (error) {
        console.error('Fehler beim Laden der Patienteninformationen:', error);
      }
    }
  }, []);

  // Update patient info and save to localStorage
  const updatePatientInfo = (updates: Partial<PatientInfo>) => {
    const newInfo = { ...patientInfo, ...updates };
    setPatientInfo(newInfo);
    localStorage.setItem('icu-patient-info', JSON.stringify(newInfo));
  };

  const handleClearPatientData = () => {
    const emptyInfo = { name: '', gender: '' };
    setPatientInfo(emptyInfo);
    localStorage.removeItem('icu-patient-info');
  };

  const handleGenerateTransferSummary = useCallback(async () => {
    if (!patientNotes.trim()) {
      toast.error('Bitte geben Sie Patientennotizen ein.');
      return;
    }

    setIsGenerating(true);
    setActiveTab('zusammenfassung');

    const prompt = JSON.stringify({
      patientNotes: patientNotes || '',
    });

    try {
      await completedTransfer.complete(prompt);

      // Check for errors after completion
      if (completedTransfer.error) {
        console.error(
          'Transfer summary generation error:',
          completedTransfer.error
        );
        toast.error('Fehler beim Generieren des Verlegungsbriefs');
      } else if (completedTransfer.completion) {
        toast.success('Verlegungsbrief erfolgreich generiert');
      }
    } catch (err) {
      toast.error('Fehler beim Generieren des Verlegungsbriefs');
      console.error('Transfer summary generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    patientNotes,
    completedTransfer.complete,
    completedTransfer.error,
    completedTransfer.completion,
  ]);

  const handleCopy = async () => {
    if (!completedTransfer.completion) return;

    try {
      await navigator.clipboard.writeText(completedTransfer.completion);
      setCopied(true);
      toast.success('Zusammenfassung kopiert');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Fehler beim Kopieren');
      console.error('Copy error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '1') {
      e.preventDefault();
      document.getElementById('patient-notes')?.focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && patientNotes.trim()) {
        handleGenerateTransferSummary();
      }
    }
  };

  return (
    <div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-full bg-solarized-blue/10 p-3">
              <Stethoscope className="h-8 w-8 text-solarized-blue" />
            </div>
            <div>
              <h1 className="font-bold text-3xl text-primary">
                ICU Verlegungsbrief
              </h1>
              <p className="text-lg text-muted-foreground">
                Erstellen Sie professionelle Verlegungsbriefe für Ihre
                ICU-Patienten
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 xl:grid-cols-6">
          {/* Patient Info Card */}
          <div className="lg:col-span-2 xl:col-span-2">
            <Card className="h-fit border-solarized-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-cyan/5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-solarized-blue" />
                    <CardTitle className="text-base text-foreground">
                      Patienteninformationen
                    </CardTitle>
                  </div>
                  {(patientInfo.name || patientInfo.gender) && (
                    <button
                      type="button"
                      onClick={handleClearPatientData}
                      className="self-start text-muted-foreground text-xs transition-colors hover:text-foreground"
                    >
                      Alle Daten löschen
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {/* Input fields for name and gender */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="patient-name"
                      className="font-medium text-foreground"
                    >
                      Name
                    </Label>
                    <Input
                      id="patient-name"
                      placeholder="Patient Name eingeben..."
                      value={patientInfo.name}
                      onChange={(e) =>
                        updatePatientInfo({ name: e.target.value })
                      }
                      className="border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="patient-gender"
                      className="font-medium text-foreground"
                    >
                      Geschlecht
                    </Label>
                    <Select
                      value={patientInfo.gender}
                      onValueChange={(value) =>
                        updatePatientInfo({ gender: value })
                      }
                    >
                      <SelectTrigger className="border-input bg-background text-foreground transition-all focus:border-solarized-blue focus:ring-solarized-blue/20">
                        <SelectValue placeholder="Geschlecht auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="männlich">männlich</SelectItem>
                        <SelectItem value="weiblich">weiblich</SelectItem>
                        <SelectItem value="divers">divers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Auto-extracted information and Input Fields */}
                <div className="border-border/50 border-t pt-6">
                  <h4 className="mb-4 flex items-center gap-2 font-semibold text-foreground text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
                    Weitere Informationen
                  </h4>

                  {/* Extracted Information */}
                  {(patientInfo.extractedInfo?.age ||
                    patientInfo.diagnosis ||
                    patientInfo.status) && (
                    <div className="mb-4 grid grid-cols-1 gap-3 text-sm">
                      {patientInfo.extractedInfo?.age && (
                        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                          <span className="text-muted-foreground">Alter:</span>
                          <span className="font-medium text-foreground">
                            {patientInfo.extractedInfo.age}
                          </span>
                        </div>
                      )}

                      {patientInfo.diagnosis && (
                        <div className="rounded-lg bg-muted/30 px-3 py-2">
                          <div className="mb-1 text-muted-foreground text-xs">
                            Diagnose:
                          </div>
                          <div className="text-foreground text-xs leading-relaxed">
                            {patientInfo.diagnosis}
                          </div>
                        </div>
                      )}

                      {patientInfo.status && (
                        <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge
                            variant={
                              patientInfo.status === 'Stabil'
                                ? 'outline'
                                : 'destructive'
                            }
                            className="border-solarized-green/30 bg-solarized-green/10 text-solarized-green"
                          >
                            {patientInfo.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input Fields from Markdoc */}
                  {completedTransfer.completion && (
                    <div className="space-y-3">
                      <div className="text-muted-foreground text-xs">
                        Formulareingaben:
                      </div>
                      <Inputs
                        inputTags={JSON.stringify(
                          parseMarkdocToInputs(
                            completedTransfer.completion || ''
                          )
                        )}
                        onChange={handleValuesChange}
                      />
                    </div>
                  )}

                  {!patientInfo.diagnosis &&
                    !patientInfo.extractedInfo?.age &&
                    !patientInfo.status &&
                    !completedTransfer.completion && (
                      <div className="rounded-lg border border-muted-foreground/20 border-dashed bg-muted/20 p-4 text-center">
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Informationen werden automatisch aus den
                          Patientennotizen extrahiert
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
            <Card className="border-solarized-cyan/20 shadow-lg">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <CardHeader className="bg-gradient-to-r from-solarized-cyan/5 to-solarized-blue/5">
                  <TabsList className="grid grid-cols-2 bg-background/50 backdrop-blur-sm">
                    <TabsTrigger
                      value="notizen"
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                    >
                      Patientennotizen
                    </TabsTrigger>
                    <TabsTrigger
                      value="zusammenfassung"
                      className="data-[state=active]:bg-solarized-blue data-[state=active]:text-primary-foreground"
                    >
                      Verlegungsbrief
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                {/* Patient Notes Tab */}
                <TabsContent value="notizen" className="space-y-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <FileText className="h-5 w-5 text-solarized-blue" />
                      Patientennotizen
                    </CardTitle>
                    <CardDescription>
                      Dokumentieren Sie den Zustand und die Behandlung des
                      Patienten während des ICU-Aufenthalts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      id="patient-notes"
                      placeholder="Geben Sie hier Ihre Notizen zum Patienten ein..."
                      className="min-h-[400px] resize-none border-input bg-background text-foreground transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                      value={patientNotes}
                      onChange={(e) => setPatientNotes(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading}
                    />
                  </CardContent>
                  <CardFooter className="flex items-center justify-between bg-muted/20">
                    <div className="space-x-4 text-muted-foreground text-sm">
                      <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                        ⌘⇧1
                      </kbd>{' '}
                      <span>für Fokus</span>
                      <kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
                        ⌘↵
                      </kbd>{' '}
                      <span>zum Generieren</span>
                    </div>
                    <Button
                      onClick={handleGenerateTransferSummary}
                      disabled={isLoading || !patientNotes.trim()}
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
                          Verlegungsbrief generieren
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </TabsContent>

                {/* Transfer Summary Tab */}
                <TabsContent value="zusammenfassung" className="space-y-0">
                  <CardContent>
                    {isLoading && !completedTransfer.completion ? (
                      <div className="flex flex-col items-center justify-center space-y-4 text-center">
                        <div className="relative">
                          <div className="h-20 w-20 animate-pulse rounded-full border-4 border-solarized-blue/20" />
                          <div className="absolute top-0 left-0 h-20 w-20 animate-spin rounded-full border-4 border-solarized-blue border-t-transparent" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-semibold text-foreground text-lg">
                            Verlegungsbrief wird generiert...
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            Bitte warten Sie, während der KI-Assistent Ihren
                            Verlegungsbrief erstellt
                          </p>
                        </div>
                      </div>
                    ) : completedTransfer.completion ? (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 font-semibold text-foreground text-sm">
                            <div className="h-1.5 w-1.5 rounded-full bg-solarized-green" />
                            ICU Verlegungsbrief
                          </h4>
                          <ScrollArea className="h-[500px] rounded-lg border border-solarized-green/20 bg-background/50 p-6">
                            <MemoizedCopySection
                              title="ICU Verlegungsbrief"
                              values={values}
                              content={
                                completedTransfer.completion ||
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
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                        <div className="rounded-full bg-muted/20 p-6">
                          <FileText className="h-16 w-16" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-semibold text-lg">
                            Noch kein Verlegungsbrief vorhanden
                          </h3>
                          <p className="max-w-md text-sm">
                            Bitte geben Sie zuerst Patientennotizen ein und
                            generieren Sie einen Verlegungsbrief.
                          </p>
                          <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => setActiveTab('notizen')}
                          >
                            Zu Notizen wechseln
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between bg-muted/20">
                    <Button
                      variant="outline"
                      disabled={!completedTransfer.completion}
                      className="shadow-sm"
                    >
                      Macht aktuell noch nichts
                    </Button>
                    <div className="flex gap-3">
                      {completedTransfer.completion && (
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
                        onClick={handleGenerateTransferSummary}
                        disabled={isLoading || !patientNotes.trim()}
                        className="bg-solarized-green shadow-lg transition-all hover:bg-solarized-green/90"
                      >
                        <FileText className="mr-2 size-4" />
                        Neu generieren
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
