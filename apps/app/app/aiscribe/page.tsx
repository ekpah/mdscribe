'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { DispositionTab } from './components/DispositionTab';
import { InputTab } from './components/InputTab';
import { OutputTab } from './components/OutputTab';
import { useAICompletion } from './hooks/useAICompletion';
import { useAnamneseForm } from './hooks/useAnamneseForm';
import { useTabState } from './hooks/useTabState';

export default function AITextGenerator() {
  const { formData, handleFormChange, handleInputChange } = useAnamneseForm();

  const {
    activeTab,
    isInputExpanded,
    isOutputExpanded,
    isDispositionExpanded,
    toggleInputTab,
    toggleOutputTab,
    toggleDispositionTab,
  } = useTabState();

  const {
    getDifferentialDiagnosis,
    anamnese,
    discharge,
    outputData,
    dispositionOutputData,
  } = useAICompletion();

  const handleSubmitInput = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      toggleOutputTab();

      const prompt = JSON.stringify({
        vordiagnosen: formData.vordiagnosen || '',
        anamnese: formData.anamnese || '',
      });
      getDifferentialDiagnosis(prompt);
      anamnese.complete(prompt);
    },
    [anamnese, formData, toggleOutputTab, getDifferentialDiagnosis]
  );

  const handleSubmitDischarge = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      toggleDispositionTab();

      const prompt = JSON.stringify({
        diagnosen: outputData.diagnoseblock,
        anamnese: outputData.anamnese,
      });
      discharge.complete(prompt);
    },
    [discharge, outputData, toggleDispositionTab]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmitInput();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmitInput]);

  useHotkeys(['meta+k', 'ctrl+k'], (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (notesInputRef.current) {
      notesInputRef.current.focus();
      notesInputRef.current.value = '';
    }
  });

  const notesInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="container mx-auto size-full overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        <InputTab
          isExpanded={isInputExpanded}
          isActive={activeTab === 'input'}
          isLoading={anamnese.isLoading}
          formData={formData}
          onToggle={toggleInputTab}
          onSubmit={handleSubmitInput}
          onInputChange={handleInputChange}
        />

        <OutputTab
          isExpanded={isOutputExpanded}
          isActive={activeTab === 'output'}
          isLoading={anamnese.isLoading}
          isDischargeLoading={discharge.isLoading}
          completion={anamnese.completion}
          outputData={outputData}
          onSubmit={handleSubmitDischarge}
          onToggle={toggleOutputTab}
          onFormChange={handleFormChange}
          hasAnamnese={!!outputData.anamnese}
        />

        <DispositionTab
          isExpanded={isDispositionExpanded}
          isActive={activeTab === 'disposition'}
          isLoading={discharge.isLoading}
          dispositionOutputData={dispositionOutputData}
          onToggle={toggleDispositionTab}
          onFormChange={handleFormChange}
        />
      </div>
    </div>
  );
}
