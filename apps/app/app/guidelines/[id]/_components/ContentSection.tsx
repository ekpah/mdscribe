'use client';

import type { Prisma } from '@repo/database';
import Inputs from '@repo/design-system/components/inputs/Inputs';
import { Card } from '@repo/design-system/components/ui/card';
import { DynamicMarkdocRenderer } from '@repo/markdoc-md';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { useState } from 'react';

export default function ContentSection({
  note,
}: {
  note: string;
  inputTags: string;
  guideline?: Prisma.GuidelineCreateInput;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});


  const handleFormChange = (data: Record<string, unknown>) => {
    setValues(data);
  };
  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div
        className="hidden overflow-y-auto overscroll-none p-4 md:block"
        key="Inputs"
      >
        <Inputs
          inputTags={parseMarkdocToInputs(note)}
          onChange={handleFormChange}
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
