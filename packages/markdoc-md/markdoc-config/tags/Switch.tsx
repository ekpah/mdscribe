'use client';
import type { ReactNode } from 'react';
import React from 'react';
import { useVariables } from '../../render/context/VariableContext';

export const SwitchContext = React.createContext<string | null>(null);

// this component mainly needs to handle reactivity around the Condition

export function Switch({
  primary,
  children,
}: { primary: string | null; children: ReactNode[] }) {
  const variables = useVariables();
  let resolvedSwitchValue: string | null = null;
  if (primary !== null) {
    const valueFromContext = variables[primary];

    if (typeof valueFromContext === 'string' || valueFromContext === null) {
      resolvedSwitchValue = valueFromContext;
    } else {
      // valueFromContext is undefined (key not in variables), or a non-string/non-null type.
      // Default to null to satisfy SwitchContext's type string | null.
      // This implicitly handles the "TODO: error, if variable does not exist"
      // by providing null as the value for the context.
      resolvedSwitchValue = null;
      // Optionally, one could add a console.warn here if valueFromContext was defined but not a string/null:
      // if (valueFromContext !== undefined) {
      //   console.warn(`Switch: Variable "${primary}" in context was type ${typeof valueFromContext}, expected string or null. Using null for SwitchContext.`);
      // }
    }
  }
  // If primary was initially null, resolvedSwitchValue remains null.

  return (
    <SwitchContext.Provider value={resolvedSwitchValue}>
      <span className="rounded-md bg-solarized-green px-1 text-white opacity-90">
        {children}
      </span>
    </SwitchContext.Provider>
  );
}
