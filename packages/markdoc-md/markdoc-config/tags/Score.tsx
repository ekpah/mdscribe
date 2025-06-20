'use client';

import Formula from 'fparser';
import { useVariables } from '../../render/context/VariableContext';

type ValueObject = {
  [key: string]: number | string | ValueObject;
};

export function Score({
  formula,
  unit,
}: {
  formula: string;
  unit?: string;
}) {
  const variables = useVariables();

  try {
    const f = new Formula(formula);

    const result = f.evaluate(variables as ValueObject);

    return (
      <span className="rounded-md bg-solarized-orange px-1 text-white opacity-90">
        {result}
        {unit ? ` ${unit}` : ''}
      </span>
    );
  } catch (error) {
    console.warn('Formula evaluation error:', error);
    return (
      <span className="rounded-md bg-solarized-red px-1 text-white opacity-90">
        Error
      </span>
    );
  }
}
