'use client';

import type { InfoInputTagType, InputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { useEffect, useState } from 'react';
import { InfoInput } from './ui/InfoInput';
import { SwitchInput } from './ui/SwitchInput';

export type BaseTagType = {
  type: string;
  options: { primary: string };
};

export interface InputsProps {
  inputTags: InputTagType[];
  onChange: (data: Record<string, unknown>) => void;
}

function renderInputTag(
  input: InputTagType, 
  values: Record<string, unknown>, 
  handleInputChange: (name: string, value: unknown) => void,
  parentSwitchValue?: string
): React.ReactNode | null {
  const inputName = input.attributes.primary;
  if (!inputName) {
    console.error('Input is missing a name:', input);
    return null;
  }

  if (input.name === 'Info') {
    return (
      <InfoInput
        key={`info-${inputName}`}
        input={input}
        value={values[inputName] as string | number | undefined}
        onChange={(value) =>
          handleInputChange(
            inputName,
            input.attributes.type === 'number' &&
              !Number.isNaN(Number(value))
              ? Number(value)
              : value
          )
        }
      />
    );
  }

  if (input.name === 'Switch') {
    const currentValue = values[inputName] as string | undefined;
    
    return (
      <div key={`switch-${inputName}`}>
        <SwitchInput
          input={input}
          value={currentValue}
          onValueChange={(value) => handleInputChange(inputName, value)}
        />
        {/* Render children of selected case */}
        {currentValue && input.children && (
          <div className="ml-4 mt-4 space-y-4">
            {input.children
              .filter(child => child.name === 'Case' && child.attributes.primary === currentValue)
              .map(caseChild => 
                caseChild.children.map(grandChild => 
                  renderInputTag(grandChild, values, handleInputChange, currentValue)
                )
              )
              .flat()}
          </div>
        )}
      </div>
    );
  }

  if (input.name === 'Score') {
    // For now, render score tags similar to info tags - just pass the original input
    // The InfoInput component should handle it gracefully
    return (
      <InfoInput
        key={`score-${inputName}`}
        input={input as any}
        value={values[inputName] as string | number | undefined}
        onChange={(value) =>
          handleInputChange(
            inputName,
            !Number.isNaN(Number(value)) ? Number(value) : value
          )
        }
      />
    );
  }

  return null;
}

export default function Inputs({ inputTags = [], onChange }: InputsProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    onChange(values);
  }, [values, onChange]);

  const handleInputChange = (name: string, value: unknown) => {
    setValues((prevValues) => ({
      ...prevValues,
      [name]: value,
    }));
  };

  if (inputTags.length === 0 || !inputTags) {
    return null;
  }

  return (
    <form className="space-y-6">
      {inputTags.map((input) => renderInputTag(input, values, handleInputChange))}
    </form>
  );
}
