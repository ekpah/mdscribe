'use client';

import { Card } from '@repo/design-system/components/ui/card';
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@repo/design-system/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/design-system/components/ui/toggle-group';
import type { UseFormReturn } from 'react-hook-form';

export type CaseTagType = {
  type: 'case';
  options: { name: string };
};

export type SwitchTagType = {
  type: 'switch';
  options: { name: string };
  children: CaseTagType[];
};

interface SwitchInputProps {
  input: SwitchTagType;
  form: UseFormReturn<Record<string, unknown>>;
}

export function SwitchInput({ input, form }: SwitchInputProps) {
  const options = input.children?.filter((caseTag) => caseTag.options.name);
  const useSelect = options && options.length > 3;

  return (
    <Card
      key={`switch-${input.options.name}`}
      className="m-4 bg-secondary p-4 focus-within:border-secondary focus-within:ring-2"
    >
      <FormItem className="space-y-3">
        <FormLabel>{input.options.name}</FormLabel>
        <FormField
          name={input.options.name}
          control={form.control}
          render={({ field }) => (
            <>
              {useSelect ? (
                <Select
                  value={field.value as string}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${input.options.name}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.map((caseTag) => (
                      <SelectItem
                        key={caseTag.options.name}
                        value={caseTag.options.name}
                      >
                        {caseTag.options.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <ToggleGroup
                  type="single"
                  value={field.value as string}
                  onValueChange={field.onChange}
                  className="flex flex-row overflow-hidden rounded-md bg-background"
                >
                  {options?.map((caseTag) => (
                    <ToggleGroupItem
                      key={caseTag.options.name}
                      value={caseTag.options.name}
                      className="flex-1 rounded-none data-[state=on]:divide-muted data-[state=on]:bg-secondary-foreground data-[state=on]:text-secondary"
                    >
                      {caseTag.options.name}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            </>
          )}
        />
        <FormMessage />
      </FormItem>
    </Card>
  );
}
