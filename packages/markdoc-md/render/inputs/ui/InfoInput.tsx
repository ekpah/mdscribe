'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import type React from 'react';
import { useEffect, useState } from 'react';

export type InfoTagType = {
  type: 'info';
  options: { name: string };
};

export interface InfoInputProps {
  input: InfoTagType;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

export function InfoInput({ input, value, onChange }: InfoInputProps) {
  // Use a local state to track input value
  const [localValue, setLocalValue] = useState(value);

  // Update local state when prop value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e);
  };

  return (
    <Card
      key={`info-${input.options.name}`}
      className="m-4 bg-secondary p-4 focus-within:border-secondary focus-within:ring-2"
    >
      <div className="space-y-3">
        <Label htmlFor={input.options.name}>{input.options.name}</Label>
        <Input
          id={input.options.name}
          name={input.options.name}
          value={localValue}
          onChange={handleChange}
          placeholder={`Enter ${input.options.name}`}
        />
      </div>
    </Card>
  );
}
