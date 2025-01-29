'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';

import {
  Form,
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

export default function Inputs({
  inputTags,
  onChange,
}: { inputTags: string; onChange: SubmitHandler<FieldValues> }) {
  const parsedInputTags = JSON.parse(inputTags);
  const methods = useForm();

  return (
    <div key="inputs">
      <Form {...methods}>
        <form onChange={methods.handleSubmit(onChange)} className="space-y-6">
          {parsedInputTags?.inputTags?.map((input: InputTagType) => {
            if (input.type === 'info') {
              return (
                <Card key={input.options.name} className="m-4 bg-secondary p-4">
                  <FormItem className="space-y-3">
                    <FormLabel>{input.options.name} </FormLabel>
                    <Input {...methods.register(input.options.name)} />
                  </FormItem>
                </Card>
              );
            }
            if (input.type === 'switch') {
              const variable = methods.watch(input.options.name);
              return (
                <Card key={input.options.name} className="m-4 bg-secondary p-4">
                  <FormItem className="space-y-3">
                    <FormLabel>{input.options.name}</FormLabel>
                    <RadioGroup
                      className="flex flex-col space-y-1"
                      value={variable}
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
                              onClick={() =>
                                methods.setValue(
                                  input.options.name,
                                  caseTag.options.name
                                )
                              }
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
                    <FormMessage />
                  </FormItem>
                </Card>
              );
            }
          })}
        </form>
      </Form>
    </div>
  );
}
