'use client';

import Formula from 'fparser';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../design-system/components/ui/tooltip';
import { useVariables } from '../../render/context/VariableContext';

type ValueObject = {
  [key: string]: number | string | ValueObject;
};

export function Score({ formula, unit, renderUnit }: { formula: string; unit?: string; renderUnit: boolean }) {
  const variables = useVariables();

  try {
    const f = new Formula(formula);

    const result = f.evaluate(variables as ValueObject);

    const roundedResult = typeof result === 'number' ? Number(result.toFixed(2)) : result;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='cursor-help rounded-md bg-solarized-orange px-1 text-white opacity-90'>
              {roundedResult ?? result}
              {renderUnit && unit && ` ${unit}`}
            </span>
          </TooltipTrigger>
          <TooltipContent className="overflow-hidden px-2 py-1 text-sm">
            <div className="space-y-1">
              <p className="font-medium text-[13px]">Formel</p>
              <p className="text-wrap font-mono text-muted-foreground text-xs">
                {formula ? (
                  <span className=" text-muted-foreground">
                    {formula
                      ?.replace(
                        /(\[[\w_]+\])|([^a-zA-Z[\]])/g,
                        (_match, p1, p2) => (p1 ? p1 : ` ${p2} `)
                      )
                      .replace(/\s+/g, ' ')
                      .trim()}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Keine Formel</span>
                )}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } catch (_error) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className='cursor-help rounded-md bg-solarized-orange px-1 text-white opacity-90'>
              ...
              {renderUnit && unit && ` ${unit}`}
            </span>
          </TooltipTrigger>
          <TooltipContent className="overflow-hidden px-2 py-1 text-sm">
            <div className="space-y-1">
              <p className="font-medium text-[13px]">Formel</p>
              <p className="text-wrap font-mono text-muted-foreground text-xs">
                {formula ? (
                  <span className=" text-muted-foreground">
                    {formula
                      ?.replace(
                        /(\[[\w_]+\])|([^a-zA-Z[\]])/g,
                        (_match, p1, p2) => (p1 ? p1 : ` ${p2} `)
                      )
                      .replace(/\s+/g, ' ')
                      .trim()}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Keine Formel</span>
                )}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
}