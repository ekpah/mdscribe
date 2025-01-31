'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';
import { useEffect } from 'react';
import { useWatch } from 'react-hook-form';

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from '@repo/design-system/components/ui/form';

import {
  RadioGroup,
  RadioGroupItem,
} from '@repo/design-system/components/ui/radio-group';
import type { FieldValues, SubmitHandler } from 'react-hook-form';

type InputTagType = {
  type: 'info' | 'switch';
  options: { name: string };
  children?: CaseTagType[];
};

type InfoTagType = {
  type: 'info';
  options: { name: string };
};

type SwitchTagType = {
  type: 'switch';
  options: { name: string };
  children: CaseTagType[];
};

type CaseTagType = {
  type: 'case';
  options: { name: string };
};

//export const formAtom = atom<FieldValues>({});

export default function Inputs({
  inputTags,
  onChange,
}: { inputTags: string; onChange: SubmitHandler<FieldValues> }) {
  const parsedInputTags = JSON.parse(inputTags);
  const methods = useForm({
    mode: 'onChange',
  });

  //const [formData, setFormData] = useAtom(formAtom);

  //const handleFormChange: SubmitHandler<FieldValues> = (data) => {
  //  setFormData(data);
  //  console.log(data);
  //};

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
              <Card
                key={`info-${input.options.name}`}
                className="m-4 bg-secondary p-4 focus-within:border-secondary focus-within:ring-2"
              >
                <FormItem className="space-y-3">
                  <FormLabel>{input.options.name} </FormLabel>
                  <Input {...methods.register(input.options.name)} />
                </FormItem>
              </Card>
            );
          }
          if (input.type === 'switch') {
            return (
              <Card
                key={`switch-${input.options.name}`}
                className="m-4 bg-secondary p-4 focus-within:border-secondary focus-within:ring-2"
              >
                <FormItem className="space-y-3">
                  <FormLabel>{input.options.name}</FormLabel>
                  <FormField
                    name={input.options.name}
                    control={methods.control}
                    render={({ field: { onChange, value, ref } }) => (
                      <RadioGroup
                        className="flex flex-col space-y-1"
                        value={value}
                        onValueChange={(newValue) => {
                          onChange(newValue);
                        }}
                        ref={ref}
                      >
                        {input.children?.map((caseTag) => {
                          if (!caseTag.options.name) {
                            return null;
                          }
                          return (
                            <FormItem
                              key={caseTag.options.name}
                              className="flex items-center space-x-3 space-y-0"
                            >
                              <RadioGroupItem
                                className="h-5 w-5 rounded-full border border-foreground"
                                value={caseTag.options.name}
                                id={`${input.options.name}-${caseTag.options.name}`}
                              />
                              <label
                                className="text-sm"
                                htmlFor={`${input.options.name}-${caseTag.options.name}`}
                              >
                                {caseTag.options.name}
                              </label>
                            </FormItem>
                          );
                        })}
                      </RadioGroup>
                    )}
                  />
                  <FormMessage />
                </FormItem>
              </Card>
            );
          }
        })}
      </form>
    </Form>
  );
}
