'use client';

import Formula from 'fparser';
import { useVariables } from '@repo/markdoc-md/render/context/variable-context';

interface ValueObject {
  [key: string]: number | string | ValueObject;
}

const formatFormulaForTooltip = (formula: string): string =>
  formula
    .replaceAll(
      /(\[[\w_]+\])|([^a-zA-Z[\]])/g,
      (_match, p1, p2) => (p1 || ` ${p2} `)
    )
    .replaceAll(/\s+/g, ' ')
    .trim();

const getFormulaTooltipLabel = (formula: string): string => {
  const normalizedFormula = formatFormulaForTooltip(formula);
  return normalizedFormula ? `Formel: ${normalizedFormula}` : 'Keine Formel';
};

export const Score = ({ formula, unit, renderUnit }: { formula: string; unit?: string; renderUnit: boolean }) => {
  const variables = useVariables();
  const tooltipLabel = getFormulaTooltipLabel(formula);

  try {
    const f = new Formula(formula);

    const result = f.evaluate(variables as ValueObject);

    const roundedResult = typeof result === 'number' ? Number(result.toFixed(2)) : result;

    return (
      <span
        aria-label={tooltipLabel}
        className='cursor-help rounded-md bg-solarized-orange px-1 text-white opacity-90'
        title={tooltipLabel}
      >
        {roundedResult ?? result}
        {renderUnit && unit && ` ${unit}`}
      </span>
    );
  } catch {
    return (
      <span
        aria-label={tooltipLabel}
        className='cursor-help rounded-md bg-solarized-orange px-1 text-white opacity-90'
        title={tooltipLabel}
      >
        ...
        {renderUnit && unit && ` ${unit}`}
      </span>
    );
  }
};
