import { useCompletion } from '@ai-sdk/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
const XML_TAGS = ['analyse', 'zusammenfassung'] as const;

export function useAICompletion() {
  const [currentThinkingStep, setCurrentThinkingStep] = useState<string>('');
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState<{
    icd_code: string;
    diagnosis: string;
  }>({
    icd_code: '',
    diagnosis: '',
  });

  async function getDifferentialDiagnosis(prompt: string) {
    const response = await fetch('/api/scribe/diagnosis', {
      method: 'POST',
      body: JSON.stringify({
        prompt: prompt,
      }),
    });
    const json = await response.json();
    setDifferentialDiagnosis({
      icd_code: json.icd_code,
      diagnosis: json.diagnosis,
    });
    return json;
  }

  const anamnese = useCompletion({
    api: '/api/scribe/anamnese',
    experimental_throttle: 50,
    onError: (error: Error) => {
      console.log('errormessage', error, error.message);
      toast.error(`Fehler beim Generieren der Anamnese: ${error.message}`);
    },
  });

  const discharge = useCompletion({
    api: '/api/scribe/discharge',
    experimental_throttle: 50,
    onError: (error: Error) => {
      console.log('errormessage', error, error.message);
      toast.error(
        `Fehler beim Generieren des Entlassungsberichts: ${error.message}`
      );
    },
  });

  const getCurrentThinkingStep = useCallback((completion: string): string => {
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
    return 'analysis';
  }, []);

  useEffect(() => {
    setCurrentThinkingStep(getCurrentThinkingStep(anamnese.completion || ''));
  }, [anamnese.completion, getCurrentThinkingStep]);

  const outputData = {
    diagnoseblock: differentialDiagnosis?.diagnosis || '',
    anamnese: anamnese?.completion?.split('</analyse>')[1] || '',
  };
  console.log(discharge);
  const dispositionOutputData = {
    diagnoseblock: differentialDiagnosis?.diagnosis || '',
    anamnese: anamnese?.completion?.split('</analyse>')[1] || '',
    summary: discharge?.completion || '',
  };

  return {
    differentialDiagnosis,
    getDifferentialDiagnosis,
    anamnese,
    discharge,
    currentThinkingStep,
    outputData,
    dispositionOutputData,
  };
}
