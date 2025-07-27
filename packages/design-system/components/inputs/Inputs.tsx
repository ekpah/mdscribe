'use client';

import type {
  InfoInputTagType,
  InputTagType,
} from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import Formula from 'fparser';
import { Sigma } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { InfoInput } from './ui/InfoInput';
import { SwitchInput } from './ui/SwitchInput';

interface InputsProps {
  inputTags: InputTagType[];
  onChange: (data: Record<string, unknown>) => void;
}

function renderInputTag(
  input: InputTagType,
  values: Record<string, unknown>,
  handleInputChange: (name: string, value: unknown) => void
): React.ReactNode | null {
  if (!input.attributes.primary) {
    return null;
  }

  if (input.name === 'Info') {
    return (
      <InfoInput
        input={input}
        key={`info-${input.attributes.primary}`}
        onChange={(value) => handleInputChange(input.attributes.primary, value)}
        value={values[input.attributes.primary] as string | number | undefined}
      />
    );
  }

  if (input.name === 'Switch') {
    const currentValue = values[input.attributes.primary] as string | undefined;

    return (
      <div key={`switch-${input.attributes.primary}`}>
        <SwitchInput
          input={input}
          onChange={(value) =>
            handleInputChange(input.attributes.primary, value)
          }
          value={currentValue}
        />
        {/* Render children of selected case */}
        {currentValue && input.children && (
          <div className="mt-4 ml-4 space-y-4">
            {input.children
              .filter(
                (child) =>
                  child.name === 'Case' &&
                  child.attributes.primary === currentValue
              )
              .flatMap((caseChild) =>
                caseChild.children.map((grandChild) =>
                  renderInputTag(grandChild, values, handleInputChange)
                )
              )}
          </div>
        )}
      </div>
    );
  }

  if (input.name === 'Score') {
    const score = () => {
      try {
        const f = new Formula(input.attributes.formula ?? '');
        const result = f.evaluate(values as Record<string, number>);

        const roundedResult =
          typeof result === 'number' ? Number(result.toFixed(2)) : result;

        return roundedResult;
      } catch (error) {
        return 0;
      }
    };

    return (
      <div
        className="justify-center-center w-full max-w-full space-y-3"
        key={`score-${input.attributes.primary}`}
      >
        <Label
          className="font-medium text-foreground"
          htmlFor={`score-${input.attributes.primary}`}
        >
          {input.attributes.primary}
        </Label>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="ml-2 bg-muted-foreground">
                <Sigma aria-hidden="true" className="opacity-60" size={12} />
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="overflow-hidden px-2 py-1 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-[13px]">Formel</p>
                <p className="text-wrap font-mono text-muted-foreground text-xs">
                  {input.attributes.formula ? (
                    <span className=" text-muted-foreground">
                      {input.attributes.formula
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

        {/* Read-only calculated score display */}
        <div className="w-full max-w-full space-y-1">
          <Input
            className="h-9 w-full max-w-full cursor-default border-input bg-muted font-medium text-foreground focus:border-solarized-orange focus:ring-solarized-orange/20"
            id={`score-${input.attributes.primary}`}
            readOnly
            value={`${score()}${input.attributes.unit ? ` ${input.attributes.unit}` : ''}`}
          />
        </div>
        {/* Variable inputs (indented) */}
        {input.children.length > 0 && (
          <div className="ml-4 w-full max-w-full space-y-3 border-muted border-l-2 pr-4 pl-4">
            {input.children.map((child) => (
              <div
                className="w-full max-w-full space-y-1"
                key={child.attributes.primary}
              >
                <InfoInput
                  input={
                    {
                      attributes: {
                        primary: child.attributes.primary,
                        type: 'number',
                      },
                    } as InfoInputTagType
                  }
                  onChange={(value) =>
                    handleInputChange(child.attributes.primary, value)
                  }
                  value={values[child.attributes.primary] as number | undefined}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function Inputs({ inputTags = [], onChange }: InputsProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    onChange(values);
  }, [values, onChange]);

  const handleInputChange = (key: string, value: unknown) => {
    setValues((prevValues) => ({
      ...prevValues,
      [key]: value,
    }));
  };

  if (inputTags.length === 0 || !inputTags) {
    return null;
  }

  return (
    <form className="w-full max-w-full space-y-6 pr-4">
      {inputTags.map((inputTag) =>
        renderInputTag(inputTag, values, handleInputChange)
      )}
    </form>
  );
}
