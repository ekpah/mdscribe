'use client';
import type { ReactNode } from 'react';
import React from 'react';
import { useVariables } from '@repo/markdoc-md/render/context/variable-context';

export const SwitchContext = React.createContext<string | null>(null);

// this component mainly needs to handle reactivity around the Condition

export const Switch = ({
  primary,
  children,
}: { primary: string | null; children: ReactNode[] }) => {
  const variables = useVariables();
  let resolvedSwitchValue: string | null = null;
  if (primary !== null) {
    const valueFromContext = variables[primary];
    // valueFromContext can be undefined or a non-string/non-null type; map those to null.
    resolvedSwitchValue =
      typeof valueFromContext === 'string' || valueFromContext === null
        ? valueFromContext
        : null;
  }
  // If primary was initially null, resolvedSwitchValue remains null.

  return (
    <SwitchContext.Provider value={resolvedSwitchValue}>
      <span className="rounded-md bg-solarized-green px-1 text-white opacity-90">
        {children}
      </span>
    </SwitchContext.Provider>
  );
};
