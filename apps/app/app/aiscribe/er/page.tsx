'use client';

import {
  useCompletion,
  experimental_useObject as useObject,
} from '@ai-sdk/react';
import { useAtom } from 'jotai';
import { useCallback, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';
import { formAtom } from '../../templates/[id]/_components/ContentSection';
import { InputTab } from './_components/InputTab';
import { OutputTab } from './_components/OutputTab';
const XML_TAGS = ['analyse', 'zusammenfassung'] as const;

interface FormData {
  anamnese: string;
}
type TabState = 'input' | 'output';

export default function ICUAIGenerator() {
  const [formData, setFormData] = useState<FormData>({
    anamnese: '',
  });
  const [differentialDiagnosis, setDifferentialDiagnosis] =
    useState<string>('');
  const [anamnese, setAnamnese] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabState>('input');
  const [isInputExpanded, setIsInputExpanded] = useState<boolean>(true);
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(false);

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

  const [inputsData, setInputsData] = useAtom(formAtom);

  const handleFormChange = (data: FieldValues) => {
    setInputsData(data);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmitInput = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isLoading) return;
      setIsLoading(true);
      toggleOutputTab();
      setDifferentialDiagnosis('');
      setAnamnese('');
      const prompt = JSON.stringify({
        anamnese: formData.anamnese || '',
      });
      await fetch('/api/scribe/diagnosis', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt,
        }),
      }).then((response) => {
        response.json().then((json) => {
          setDifferentialDiagnosis(json.text);
        });
      });
      await fetch('/api/scribe/anamnese', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt,
        }),
      }).then((response) => {
        response.json().then((json) => {
          setAnamnese(json.text);
          setIsLoading(false);
        });
      });
    },
    [anamnese, formData, toggleOutputTab, setDifferentialDiagnosis]
  );

  return (
    <div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
      <div className="flex flex-col gap-4">
        <InputTab
          isExpanded={isInputExpanded}
          isActive={activeTab === 'input'}
          isLoading={isLoading}
          formData={formData}
          onToggle={toggleInputTab}
          onSubmit={handleSubmitInput}
          onInputChange={handleInputChange}
        />

        <OutputTab
          isExpanded={isOutputExpanded}
          isActive={activeTab === 'output'}
          isLoading={isLoading}
          anamnese={anamnese.split('<diagnoseblock>')[0]}
          diagnosis={differentialDiagnosis}
          onToggle={toggleOutputTab}
          onFormChange={handleFormChange}
          hasAnamnese={!!anamnese}
        />
      </div>
    </div>
  );
}
