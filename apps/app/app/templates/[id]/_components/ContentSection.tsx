'use client';
import { atom, useAtom } from 'jotai';

import { Card } from '@repo/design-system/components/ui/card';

import type { Prisma } from '@prisma/client';
import Inputs from './Inputs';
import Note from './Note';

export const formAtom = atom({});

export default function ContentSection({
  note,
  inputTags = '[]',
  template,
}: {
  note: string;
  inputTags: string;
  template: Prisma.TemplateGetPayload<{}>;
}) {
  const [formData, setFormData] = useAtom(formAtom);

  const handleFormChange = (data) => {
    setFormData(data);
  };
  return (
    <Card className="grid grid-cols-3 gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] overflow-hidden">
      <div key="Inputs" className="p-4 overflow-y-auto overscroll-none">
        <Inputs inputTags={inputTags} onChange={handleFormChange} />
      </div>
      <div
        key="Note"
        className="overflow-y-auto overscroll-none col-span-2 border-l p-4"
      >
        <Note note={note} />
      </div>
    </Card>
  );
}
