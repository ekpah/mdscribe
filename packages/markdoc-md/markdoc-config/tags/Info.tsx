'use client';

import { useVariables } from '../../render/context/VariableContext';

export function Info({ primary }: { primary: string }) {
  const variables = useVariables();
  // Look up the value from context using the 'primary' prop as the key.
  // Provide an empty string as a fallback if the variable doesn't exist.
  const value = variables[primary] ?? '';

  // TODO: consider adding more robust error handling or logging
  // if a variable is expected but not found.
  // Example: if (variables[primary] === undefined) { console.warn(...) }

  return (
    <span className="rounded-md bg-solarized-blue/90 px-1 text-white">
      {value}
    </span>
  );
}
