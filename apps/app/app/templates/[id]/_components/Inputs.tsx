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
  infoTags: string[];
  switchTags: {
    variable: string;
    options: string[];
  }[];
};

export default function Inputs({
  inputTags,
  onChange,
}: { inputTags: string; onChange: SubmitHandler<FieldValues> }) {
  const parsedInputTags: InputTagType = JSON.parse(inputTags);

  const methods = useForm();

  return (
    <div key="inputs">
      <Form {...methods}>
        <form onChange={methods.handleSubmit(onChange)} className="space-y-6">
          {parsedInputTags.infoTags.map((variable) => {
            return (
              <Card key={variable} className="m-4 bg-secondary p-4">
                <FormItem className="space-y-3">
                  <FormLabel>{variable} </FormLabel>
                  <Input {...methods.register(variable)} />
                </FormItem>
              </Card>
            );
          })}
          {parsedInputTags.switchTags.map((select) => {
            const variable = methods.watch(select.variable);

            return (
              <Card key={select.variable} className="m-4 bg-secondary p-4">
                <FormItem className="space-y-3">
                  <FormLabel>{select.variable}</FormLabel>
                  <RadioGroup
                    className="flex flex-col space-y-1"
                    value={variable}
                  >
                    {select.options.map((option) => {
                      if (!option) {
                        return null;
                      }
                      return (
                        <FormItem
                          key={option}
                          className="flex items-center space-x-3 space-y-0"
                        >
                          <RadioGroupItem
                            className="h-5 w-5 rounded-full border border-foreground"
                            value={option}
                            id={`${select.variable}-${option}`}
                            onClick={() =>
                              methods.setValue(select.variable, option)
                            }
                          />
                          <label
                            className="text-sm"
                            htmlFor={`${select.variable}-${option}`}
                          >
                            {option}
                          </label>
                        </FormItem>
                      );
                    })}
                  </RadioGroup>
                  <FormMessage />
                </FormItem>
              </Card>
            );
          })}
        </form>
      </Form>
    </div>
  );
}
