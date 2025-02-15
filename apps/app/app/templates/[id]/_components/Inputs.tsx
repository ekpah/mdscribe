'use client';

import { Form, useForm } from '@repo/design-system/components/ui/form';
import { useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { InfoInput, type InfoTagType } from './InfoInput';
import { SwitchInput, type SwitchTagType } from './SwitchInput';

export type InputTagType = InfoTagType | SwitchTagType;

export interface InputsProps {
  inputTags: string;
  onChange: (data: Record<string, unknown>) => void;
}

export default function Inputs({ inputTags, onChange }: InputsProps) {
  const parsedInputTags = JSON.parse(inputTags);
  const methods = useForm({
    mode: 'onChange',
  });

  const formValues = useWatch({
    control: methods.control,
  });

  // Update parent component when form values change
  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  return (
    <Form {...methods} key="inputs">
      <form className="space-y-6">
        {parsedInputTags?.inputTags?.map((input: InputTagType) => {
          if (input.type === 'info') {
            return (
              <InfoInput
                key={input.options.name}
                input={input}
                form={methods}
              />
            );
          }
          if (input.type === 'switch') {
            return (
              <SwitchInput
                key={input.options.name}
                input={input}
                form={methods}
              />
            );
          }
          return null;
        })}
      </form>
    </Form>
  );
}
