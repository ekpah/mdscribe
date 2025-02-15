'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { FormItem, FormLabel } from '@repo/design-system/components/ui/form';
import { Input } from '@repo/design-system/components/ui/input';
import type { UseFormReturn } from 'react-hook-form';

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
      <FormItem className="space-y-3">
        <FormLabel>{input.options.name}</FormLabel>
        <Input {...form.register(input.options.name)} />
      </FormItem>
    </Card>
  );
}
