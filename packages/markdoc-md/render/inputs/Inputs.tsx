'use client';

import { useEffect, useState } from 'react';
import { InfoInput, type InfoTagType } from './ui/InfoInput';
import { SwitchInput, type SwitchTagType } from './ui/SwitchInput';

export type BaseTagType = {
  type: string;
  options: { name: string };
};

export type InputTagType = InfoTagType | SwitchTagType;

export interface InputsProps {
  inputTags: InputTagType[];
  onChange: (data: Record<string, unknown>) => void;
}

export default function Inputs({ inputTags, onChange }: InputsProps) {
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

  return (
    <form className="space-y-6">
      {inputTags?.map((input: InputTagType) => {
        const inputName = input.options.name;
        if (!inputName) {
          console.error('Input is missing a name:', input);
          return null;
        }
        if (input.type === 'info') {
          return (
            <InfoInput
              key={`info-${inputName}`}
              input={input}
              value={values[inputName] as string | number | undefined}
              onChange={(value) =>
                handleInputChange(
                  inputName,
                  input.options.type === 'number' &&
                    !Number.isNaN(Number(value))
                    ? Number(value)
                    : value
                )
              }
            />
          );
        }

        if (input.type === 'switch') {
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
