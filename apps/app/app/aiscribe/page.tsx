'use client';

import { useCompletion } from '@ai-sdk/react';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Label } from '@repo/design-system/components/ui/label';
import {} from '@repo/design-system/components/ui/select';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import Inputs from '../templates/[id]/_components/Inputs';
import { CopyableSection } from './_components/CopyableSection';
import { ThinkingSteps } from './_components/ThinkingSteps';

const XML_TAGS = [
  'analysis',
  'diagnoseblock',
  'summary',
  'conclusion',
  'plan',
] as const;

const thinkingSteps = [
  {
    id: 'analysis',
    title: 'Analysiere Patientendaten und Vorgeschichte',
    content: 'Verarbeite die eingegebenen Informationen zur weiteren Analyse',
  },
  {
    id: 'summarize',
    title: 'Generiere Anamnesezusammenfassung',
    content: 'Extrahiere die wichtigsten Punkte aus der Anamnese',
  },
  {
    id: 'diagnose',
    title: 'Erstelle strukturierten Diagnoseblock',
    content: 'Identifiziere und formatiere relevante Diagnosen',
  },
];

export default function AITextGenerator() {
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');
  const [isInputExpanded, setIsInputExpanded] = useState<boolean>(true);
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    vordiagnosen: string;
    anamnese: string;
  }>({
    vordiagnosen: '',
    anamnese: '',
  });
  const [currentThinkingStep, setCurrentThinkingStep] = useState<string>('');

  const getCurrentThinkingStep = (completion: string): string => {
    if (!completion) {
      return '';
    }

    for (const tag of XML_TAGS) {
      const openTag = `<${tag}>`;
      const closeTag = `</${tag}>`;

      if (completion.includes(openTag) && !completion.includes(closeTag)) {
        return tag;
      }
    }

    return '';
  };

  const { completion, complete, isLoading } = useCompletion({
    api: '/api/scribe',
    experimental_throttle: 50,
    onError: (error: Error) => {
      console.log('errormessage', error, error.message);
      toast.error(`Fehler beim Generieren der Anamnese: ${error.message}`);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    setActiveTab('output');
    setIsInputExpanded(false);
    setIsOutputExpanded(true);

    const prompt = JSON.stringify({
      vordiagnosen: formData.vordiagnosen,
      anamnese: formData.anamnese,
    });
    complete(prompt);
  };

  const toggleInputTab = () => {
    setActiveTab('input');
    setIsInputExpanded(true);
    setIsOutputExpanded(false);
  };

  const toggleOutputTab = () => {
    setActiveTab('output');
    setIsInputExpanded(false);
    setIsOutputExpanded(true);
  };

  const outputData = completion
    ? {
        diagnoseblock:
          completion
            .split('<diagnoseblock>')[1]
            ?.split('</diagnoseblock>')[0] || '',
        anamnese:
          completion.split('</analysis>')[1]?.split('<diagnoseblock>')[0] || '',
        summary: completion.split('<summary>')[1]?.split('</summary>')[0] || '',
        conclusion:
          completion.split('<conclusion>')[1]?.split('</conclusion>')[0] || '',
        plan: completion.split('<plan>')[1]?.split('</plan>')[0] || '',
      }
    : {
        diagnoseblock: '',
        anamnese: '',
      };

  useEffect(() => {
    setCurrentThinkingStep(getCurrentThinkingStep(completion || ''));
  }, [completion]);

  return (
    <div className="container mx-auto size-full overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {/* Input Tab */}
        <motion.div
          className="relative"
          animate={{
            height: isInputExpanded ? 'auto' : '60px',
            opacity: isInputExpanded ? 1 : 0.8,
          }}
          transition={{ duration: 0.3 }}
        >
          <Card
            className={`size-full overflow-hidden ${activeTab === 'input' ? 'border-primary' : 'border-muted'}`}
          >
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between bg-card p-4"
              onClick={toggleInputTab}
            >
              <CardTitle className="text-lg">Eingabe</CardTitle>
              {isInputExpanded ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            <AnimatePresence>
              {isInputExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="p-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="vordiagnosen">Vordiagnosen</Label>
                        <Textarea
                          id="vordiagnosen"
                          name="vordiagnosen"
                          placeholder="Geben Sie hier die Vordiagnosen ein..."
                          value={formData.vordiagnosen}
                          onChange={handleInputChange}
                          className="min-h-[100px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="anamnese">Anamnese</Label>
                        <Textarea
                          id="anamnese"
                          name="anamnese"
                          placeholder="Geben Sie hier die Anamnese ein..."
                          value={formData.anamnese}
                          onChange={handleInputChange}
                          className="min-h-[150px]"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full"
                      >
                        Verarbeiten
                      </Button>
                    </form>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Output Tab */}
        <motion.div
          className="relative"
          animate={{
            height: isOutputExpanded ? 'auto' : '60px',
            opacity: isOutputExpanded ? 1 : 0.8,
          }}
          transition={{ duration: 0.3 }}
        >
          <Card
            className={`overflow-hidden ${activeTab === 'output' ? 'border-primary' : 'border-muted'}`}
          >
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between bg-card p-4"
              onClick={toggleOutputTab}
              onKeyDown={(e) => e.key === 'Enter' && toggleOutputTab()}
            >
              <CardTitle className="text-lg">Dokumentation</CardTitle>
              {isOutputExpanded ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>

            <AnimatePresence>
              {isOutputExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Left Side - Input Fields and Selections */}
                      <Inputs
                        inputs={['vordiagnosen', 'anamnese']}
                        onChange={() => {}}
                      />

                      {/* Right Side - Output Sections */}
                      <div className="space-y-4">
                        {/* Thinking Steps */}
                        <ThinkingSteps
                          steps={thinkingSteps}
                          currentStep={currentThinkingStep}
                          isComplete={!isLoading}
                        />
                        {Object.entries(outputData).map(
                          ([section, content]) => (
                            <CopyableSection
                              key={section}
                              title={section}
                              content={content || `Kein ${section} verfügbar`}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
