'use client';

import Formula from 'fparser';
import { toFormulaValue } from '../../parse/boolean-coercion';
import { useVariables } from '../../render/context/variable-context';
import { InteractiveTag } from './interactive-tag';

interface ValueObject {
  [key: string]: number | string | ValueObject;
}

export interface ScoreProps {
  formula: string;
  primary?: string;
  unit?: string;
  renderUnit?: boolean;
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
  return normalizedFormula ? `Formula: ${normalizedFormula}` : 'No formula';
};

export const Score = ({
  formula,
  primary,
  unit,
  renderUnit,
}: ScoreProps) => {
  const variables = useVariables();
  const normalizedFormula = typeof formula === 'string' ? formula : '';
  const tagName = typeof primary === 'string' ? primary : undefined;
  const tooltipLabel = getFormulaTooltipLabel(normalizedFormula);
  const formulaVariables: ValueObject = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, toFormulaValue(value)])
  ) as ValueObject;

  try {
    const f = new Formula(normalizedFormula);

    const result = f.evaluate(formulaVariables);

    const roundedResult = typeof result === 'number' ? Number(result.toFixed(2)) : result;

    return (
      <InteractiveTag tagName={tagName}>
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
      <InteractiveTag tagName={tagName}>
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
