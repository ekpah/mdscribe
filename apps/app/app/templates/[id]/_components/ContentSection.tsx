'use client';
import { atom, useAtom } from 'jotai';

import { Card } from '@repo/design-system/components/ui/card';

import type { Prisma } from '@repo/database';
import type { FieldValues } from 'react-hook-form';
import Inputs from './Inputs';
import Note from './Note';

export const formAtom = atom<FieldValues>({});

export default function ContentSection({
  note,
  inputTags = '[]',
  template,
}: {
  note: string;
  inputTags: string;
  template?: Prisma.TemplateCreateInput;
}) {
  const [formData, setFormData] = useAtom(formAtom);

  const handleFormChange = (data: FieldValues) => {
    setFormData(data);
  };
  return (
    <Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
      <div
        key="Inputs"
        className="hidden overflow-y-auto overscroll-none p-4 md:block"
      >
        <Inputs inputTags={inputTags} onChange={handleFormChange} />
      </div>
      <div
        key="Note"
        className="col-span-3 overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
      >
        <Note note={note} />
      </div>
    </Card>
  );
}
