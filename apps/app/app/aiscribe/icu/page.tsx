'use client';

import { useCompletion } from '@ai-sdk/react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { useAtom } from 'jotai';
import { useCallback, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { formAtom } from '../../templates/[id]/_components/ContentSection';
import { DiagnosticRequestsSection } from './_components/DiagnosticRequestsSection';
import { PatientInfoCard } from './_components/PatientInfoCard';
import { PatientInputSection } from './_components/PatientInputSection';
import { TransferSummarySection } from './_components/TransferSummarySection';

export interface ICUFormData {
  notes: string;
}

export interface DiagnosticProcedure {
  id: string;
  name: string;
  category:
    | 'Bildgebung'
    | 'Kardiologie'
    | 'Sonographie'
    | 'Endoskopie'
    | 'Labor';
  description: string;
  urgency?: 'routine' | 'urgent' | 'emergency';
}

export const DIAGNOSTIC_PROCEDURES: DiagnosticProcedure[] = [
  {
    id: 'ct-head',
    name: 'CT Kopf',
    category: 'Bildgebung',
    description: 'Computertomographie des Kopfes',
    urgency: 'routine',
  },
  {
    id: 'ct-thorax',
    name: 'CT Thorax',
    category: 'Bildgebung',
    description: 'Computertomographie des Brustkorbs',
    urgency: 'routine',
  },
  {
    id: 'ct-abdomen',
    name: 'CT Abdomen',
    category: 'Bildgebung',
    description: 'Computertomographie des Bauchraums',
    urgency: 'routine',
  },
  {
    id: 'mri-head',
    name: 'MRT Kopf',
    category: 'Bildgebung',
    description: 'Magnetresonanztomographie des Kopfes',
    urgency: 'routine',
  },
  {
    id: 'x-ray-chest',
    name: 'Röntgen Thorax',
    category: 'Bildgebung',
    description: 'Röntgenaufnahme des Brustkorbs',
    urgency: 'routine',
  },
  {
    id: 'tte',
    name: 'TTE',
    category: 'Kardiologie',
    description: 'Transthorakale Echokardiographie',
    urgency: 'routine',
  },
  {
    id: 'tee',
    name: 'TEE',
    category: 'Kardiologie',
    description: 'Transösophageale Echokardiographie',
    urgency: 'urgent',
  },
  {
    id: 'ekg',
    name: 'EKG',
    category: 'Kardiologie',
    description: 'Elektrokardiogramm',
    urgency: 'routine',
  },
  {
    id: 'sono-abdomen',
    name: 'Abdomen Sonographie',
    category: 'Sonographie',
    description: 'Ultraschalluntersuchung des Bauchraums',
    urgency: 'routine',
  },
  {
    id: 'sono-pleura',
    name: 'Pleura Sonographie',
    category: 'Sonographie',
    description: 'Ultraschalluntersuchung der Pleura',
    urgency: 'routine',
  },
  {
    id: 'bronchoscopy',
    name: 'Bronchoskopie',
    category: 'Endoskopie',
    description: 'Endoskopische Untersuchung der Atemwege',
    urgency: 'urgent',
  },
  {
    id: 'blood-gas-analysis',
    name: 'BGA',
    category: 'Labor',
    description: 'Blutgasanalyse',
    urgency: 'urgent',
  },
];

export default function ICUPage() {
  const [activeTab, setActiveTab] = useState('notizen');
  const [formData, setFormData] = useState<ICUFormData>({
    notes: '',
  });

  const [selectedProcedures, setSelectedProcedures] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isGeneratingTransfer, setIsGeneratingTransfer] = useState(false);
  const [isGeneratingRequests, setIsGeneratingRequests] = useState(false);

  // API integrations
  const transferSummary = useCompletion({
    api: '/api/scribe/icu/transfer-summary',
  });

  const diagnosticRequests = useCompletion({
    api: '/api/scribe/icu/diagnostic-requests',
  });

  const [inputsData, setInputsData] = useAtom(formAtom);

  const handleFormChange = (data: FieldValues) => {
    setInputsData(data);
  };

  const handleInputChange = useCallback((value: string) => {
    setFormData({ notes: value });
  }, []);

  const handleGenerateTransferSummary = useCallback(async () => {
    if (isGeneratingTransfer) return;

    const hasRequiredData = formData.notes.trim();
    if (!hasRequiredData) {
      toast.error('Bitte geben Sie Patientennotizen ein.');
      return;
    }

    setIsGeneratingTransfer(true);
    setActiveTab('zusammenfassung');
    try {
      const prompt = JSON.stringify({
        notes: formData.notes,
        type: 'icu-transfer-summary',
      });

      await transferSummary.complete(prompt);
      toast.success('Verlegungsbrief erfolgreich generiert');
    } catch (error) {
      toast.error('Fehler beim Generieren des Verlegungsbriefs');
      console.error('Transfer summary generation error:', error);
    } finally {
      setIsGeneratingTransfer(false);
    }
  }, [formData, transferSummary, isGeneratingTransfer]);

  const handleGenerateDiagnosticRequests = useCallback(async () => {
    if (isGeneratingRequests) return;

    if (selectedProcedures.length === 0) {
      toast.error(
        'Bitte wählen Sie mindestens eine diagnostische Maßnahme aus.'
      );
      return;
    }

    setIsGeneratingRequests(true);
    try {
      const selectedProcedureDetails = DIAGNOSTIC_PROCEDURES.filter((proc) =>
        selectedProcedures.includes(proc.id)
      );

      const prompt = JSON.stringify({
        notes: formData.notes,
        selectedProcedures: selectedProcedureDetails,
        additionalNotes,
        type: 'diagnostic-requests',
      });

      await diagnosticRequests.complete(prompt);
      toast.success('Anforderungen erfolgreich generiert');
    } catch (error) {
      toast.error('Fehler beim Generieren der Anforderungen');
      console.error('Diagnostic requests generation error:', error);
    } finally {
      setIsGeneratingRequests(false);
    }
  }, [
    formData,
    selectedProcedures,
    additionalNotes,
    diagnosticRequests,
    isGeneratingRequests,
  ]);

  const handleProcedureToggle = useCallback((procedureId: string) => {
    setSelectedProcedures((prev) =>
      prev.includes(procedureId)
        ? prev.filter((id) => id !== procedureId)
        : [...prev, procedureId]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedProcedures([]);
  }, []);

  return (
    <div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="text-center">
          <h1 className="mb-2 font-bold text-2xl text-foreground">
            Intensivstation Management
          </h1>
          <p className="text-muted-foreground">
            Erstellen Sie Verlegungsbriefe und diagnostische Anforderungen für
            Ihre ICU-Patienten
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Patient Info Card */}
          <div className="md:col-span-1">
            <PatientInfoCard />
          </div>

          {/* Main Content with Tabs */}
          <div className="md:col-span-2">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="mb-4 grid grid-cols-3">
                <TabsTrigger value="notizen">Patientennotizen</TabsTrigger>
                <TabsTrigger value="zusammenfassung">
                  ICU-Zusammenfassung
                </TabsTrigger>
                <TabsTrigger value="diagnostik">
                  Diagnostische Verfahren
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notizen" className="space-y-4">
                <PatientInputSection
                  formData={formData}
                  onInputChange={handleInputChange}
                  onFormChange={handleFormChange}
                  onGenerate={handleGenerateTransferSummary}
                  isGenerating={isGeneratingTransfer}
                />
              </TabsContent>

              <TabsContent value="zusammenfassung" className="space-y-4">
                <TransferSummarySection
                  isGenerating={isGeneratingTransfer}
                  summary={transferSummary.completion}
                  onGenerate={handleGenerateTransferSummary}
                  hasData={!!formData.notes.trim()}
                  onSwitchToNotes={() => setActiveTab('notizen')}
                />
              </TabsContent>

              <TabsContent value="diagnostik" className="space-y-4">
                <DiagnosticRequestsSection
                  procedures={DIAGNOSTIC_PROCEDURES}
                  selectedProcedures={selectedProcedures}
                  additionalNotes={additionalNotes}
                  onAdditionalNotesChange={setAdditionalNotes}
                  isGenerating={isGeneratingRequests}
                  requests={diagnosticRequests.completion}
                  onProcedureToggle={handleProcedureToggle}
                  onGenerate={handleGenerateDiagnosticRequests}
                  onClearSelection={handleClearSelection}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
