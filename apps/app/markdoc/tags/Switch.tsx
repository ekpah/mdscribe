'use client';

export const SwitchContext = React.createContext(null);

import { formAtom } from '@/app/templates/[id]/_components/ContentSection';
import { useAtomValue } from 'jotai';
import React, { type ReactNode } from 'react';
// this component mainly needs to handle reactivity around the Condition

export function Switch({
  variable,
  children,
}: { variable: string; children: ReactNode[] }) {
  // TODO: error, if variable does not exist
  const data = useAtomValue(formAtom);
  const value = data[variable];

  return (
    <SwitchContext.Provider value={value}>
      <span className="rounded-md bg-solarized-green/90 px-1 text-white">
        {children}
      </span>
    </SwitchContext.Provider>
  );
}
