'use client';

import { useCompletion } from '@ai-sdk/react';
import { useAtom } from 'jotai';
import { useCallback, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { formAtom } from '../../templates/[id]/_components/ContentSection';
import { InputTab } from './_components/InputTab';
import { OutputTab } from './_components/OutputTab';

interface FormData {
  procedureNotes: string;
}
type TabState = 'input' | 'output';

export default function ProceduresAIGenerator() {
  const [formData, setFormData] = useState<FormData>({
    procedureNotes: '',
  });
  const completedProcedure = useCompletion({
    api: '/api/scribe/procedures/stream',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabState>('input');
  const [isInputExpanded, setIsInputExpanded] = useState<boolean>(true);
  const [isOutputExpanded, setIsOutputExpanded] = useState<boolean>(false);

  const toggleInputTab = useCallback(() => {
    setActiveTab('input');
    setIsInputExpanded(true);
    setIsOutputExpanded(false);
  }, []);

  const toggleOutputTab = useCallback(() => {
    setActiveTab('output');
    setIsInputExpanded(false);
    setIsOutputExpanded(true);
  }, []);

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
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isLoading) return;
      setIsLoading(true);
      toggleOutputTab();
      const prompt = JSON.stringify({
        procedureNotes: formData.procedureNotes || '',
      });
      completedProcedure.complete(prompt);
      setIsLoading(false);
    },
    [
      formData.procedureNotes,
      isLoading,
      toggleOutputTab,
      completedProcedure.complete,
    ]
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
          procedureDocumentation={completedProcedure.completion}
          onToggle={toggleOutputTab}
          onFormChange={handleFormChange}
          hasProcedureDocumentation={!!completedProcedure.completion}
        />
      </div>
    </div>
  );
}
