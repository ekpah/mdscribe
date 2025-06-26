'use client';

import type { InputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
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
      {inputTags.map((input: InputTagType) => {
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
          return (
            <SwitchInput
              key={`switch-${inputName}`}
              input={input}
              value={values[inputName] as string | undefined}
              onValueChange={(value) => handleInputChange(inputName, value)}
            />
          );
        }
        return null;
      })}
    </form>
  );
}
