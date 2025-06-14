'use client';

import { useVariables } from '../../render/context/VariableContext';

// Safe expression evaluator for formulas
class FormulaEvaluator {
  private variables: Record<string, number | string | boolean>;

  constructor(variables: Record<string, number | string | boolean>) {
    this.variables = variables;
  }

  // Extract variable names from formula string
  static extractVariables(formula: string): string[] {
    // Match variable names (letters, numbers, underscore)
    const matches = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    // Filter out reserved words and operators
    const reserved = new Set(['true', 'false', 'null', 'undefined']);
    return [...new Set(matches.filter((match) => !reserved.has(match)))];
  }

  // Safe evaluation of expressions
  evaluate(formula: string): number | string {
    try {
      // Replace variables with their values
      let expression = formula;

      // Handle ternary operators and comparisons
      for (const [key, value] of Object.entries(this.variables)) {
        const numValue = Number(value) || 0;
        expression = expression.replace(
          new RegExp(`\\b${key}\\b`, 'g'),
          String(numValue)
        );
      }

      // Evaluate using Function constructor (safer than eval)
      // Only allow specific operators
      const allowedPattern = /^[\d\s+\-*/()>=<?:&|!.]+$/;
      if (!allowedPattern.test(expression)) {
        throw new Error('Invalid formula: contains disallowed characters');
      }

      const result = new Function(`return ${expression}`)();
      return result;
    } catch (error) {
      console.warn('Formula evaluation error:', error);
      return 'Error';
    }
  }
}

export function Score({
  formula,
  unit,
}: {
  formula: string;
  unit?: string;
}) {
  const variables = useVariables();

  const evaluator = new FormulaEvaluator(variables);
  const result = evaluator.evaluate(formula);

  return (
    <span className="rounded-md bg-solarized-orange/90 px-1 text-white">
      {result}
      {unit ? ` ${unit}` : ''}
    </span>
  );
}
