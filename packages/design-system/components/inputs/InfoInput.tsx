'use client';

import type { UseFormReturn } from 'react-hook-form';
import { Card } from '../ui/card';
import { FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';

export type InfoTagType = {
  type: 'info';
  options: { name: string };
};

interface InfoInputProps {
  input: InfoTagType;
  form: UseFormReturn<Record<string, unknown>>;
}

export function InfoInput({ input, form }: InfoInputProps) {
  return (
    <Card
      key={`info-${input.options.name}`}
      className="m-4 bg-secondary p-4 focus-within:border-secondary focus-within:ring-2"
    >
      <FormField
        control={form.control}
        name={input.options.name}
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>{input.options.name}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ? String(field.value) : ''}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </Card>
  );
}
