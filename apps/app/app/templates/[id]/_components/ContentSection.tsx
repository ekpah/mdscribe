'use client';
import { atom } from 'jotai';

import { Card } from '@repo/design-system/components/ui/card';

import type { Prisma } from '@repo/database';
import { DynamicMarkdocRenderer } from '@repo/markdoc-md';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import Inputs from '@repo/markdoc-md/render/inputs/Inputs';
import { useState } from 'react';
import type { FieldValues } from 'react-hook-form';

export const formAtom = atom<FieldValues>({});

export default function ContentSection({
  note,
}: {
  note: string;
  inputTags: string;
  template?: Prisma.TemplateCreateInput;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const handleFormChange = (data: Record<string, unknown>) => {
    setValues(data);
  };
  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div
        key="Inputs"
        className="hidden overflow-y-auto overscroll-none p-4 md:block"
      >
        <Inputs
          inputTags={JSON.stringify(parseMarkdocToInputs(note))}
          onChange={handleFormChange}
        />
      </div>
      <div
        key="Note"
        className="col-span-3 overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
      >
        <DynamicMarkdocRenderer
          markdocContent={note as string}
          variables={values}
          className="prose prose-slate grow"
        />
      </div>
    </Card>
  );
}
