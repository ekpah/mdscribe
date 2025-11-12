'use client';

import type { Prisma } from '@repo/database';
import Inputs from '@repo/design-system/components/inputs/Inputs';
import { Card } from '@repo/design-system/components/ui/card';
import { DynamicMarkdocRenderer } from '@repo/markdoc-md';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { useState } from 'react';
import { VoiceInput } from './VoiceInput';

export default function ContentSection({
  note,
}: {
  note: string;
  inputTags: string;
  template?: Prisma.TemplateCreateInput;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [suggestions, setSuggestions] = useState<Record<string, { value: string; confidence: string }>>({});

  const handleFormChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  const handleSuggestionsReceived = (newSuggestions: Record<string, { value: string; confidence: string }>) => {
    setSuggestions(newSuggestions);
  };

  const inputTags = parseMarkdocToInputs(note);

  // Extract input field information for voice input
  const inputFields = inputTags.map((tag) => ({
    name: tag.attributes.primary,
    type: tag.attributes.type || 'text',
  }));

  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div
        className="hidden overflow-y-auto overscroll-none p-4 md:block"
        key="Inputs"
      >
        <VoiceInput
          inputFields={inputFields}
          onSuggestionsReceived={handleSuggestionsReceived}
        />
        <Inputs
          inputTags={inputTags}
          onChange={handleFormChange}
          suggestions={suggestions}
        />
      </div>
      <div
        className="col-span-3 overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
        key="Note"
      >
        <DynamicMarkdocRenderer
          className="prose prose-slate grow"
          markdocContent={note as string}
          variables={values}
        />
      </div>
    </Card>
  );
}
