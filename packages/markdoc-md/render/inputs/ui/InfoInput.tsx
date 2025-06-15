'use client';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Input } from '../../../ui/components/input';
import { Label } from '../../../ui/components/label';

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
    <div key={`info-${input.options.name}`} className="space-y-2">
      <Label
        className="font-medium text-foreground"
        htmlFor={input.options.name}
      >
        {input.options.name}
      </Label>
      <Input
        id={input.options.name}
        name={input.options.name}
        value={localValue}
        onChange={handleChange}
        placeholder={`Enter ${input.options.name}`}
        className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
      />
    </div>
  );
}
