'use client';

import { formAtom } from '@/app/templates/[id]/_components/ContentSection';

import { useAtomValue } from 'jotai';

export function Info({
  primary,
  variable,
}: { primary: string; variable: string }) {
  // TODO: error, if variable does not exist
  const data = useAtomValue(formAtom);
  return <span>{data[primary] || ''}</span>;
}
