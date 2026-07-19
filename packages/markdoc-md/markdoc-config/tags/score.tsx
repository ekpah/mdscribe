'use client';

import Formula from 'fparser';
import { useVariables } from '@repo/markdoc-md/render/context/variable-context';
import { toFormulaValue } from '@repo/markdoc-md/parse/boolean-coercion';
import { InteractiveTag } from './interactive-tag';

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

export const Score = ({
  formula,
  primary,
  unit,
  renderUnit,
}: { formula: string; primary: string; unit?: string; renderUnit: boolean }) => {
  const variables = useVariables();
  const tooltipLabel = getFormulaTooltipLabel(formula);
  const formulaVariables: ValueObject = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, toFormulaValue(value)])
  ) as ValueObject;

  try {
    const f = new Formula(formula);

    const result = f.evaluate(formulaVariables);

    const roundedResult = typeof result === 'number' ? Number(result.toFixed(2)) : result;

    return (
      <InteractiveTag tagName={primary}>
        <span
          aria-label={tooltipLabel}
          className='cursor-help rounded-md bg-solarized-orange px-1 text-white opacity-90'
          title={tooltipLabel}
        >
          {roundedResult ?? result}
          {renderUnit && unit && ` ${unit}`}
        </span>
      </InteractiveTag>
    );
  } catch {
    return (
      <InteractiveTag tagName={primary}>
        <span
          aria-label={tooltipLabel}
          className='cursor-help rounded-md bg-solarized-orange px-1 text-white opacity-90'
          title={tooltipLabel}
        >
          ...
          {renderUnit && unit && ` ${unit}`}
        </span>
      </InteractiveTag>
    );
  }
};
