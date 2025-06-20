'use client';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Input } from '../../../ui/components/input';
import { Label } from '../../../ui/components/label';
import type { BaseTagType } from '../Inputs';

export type InfoTagType = BaseTagType & {
  type: 'info';
  options: {
    name: string;
    type?: 'string' | 'number';
  };
};

export interface InfoInputProps {
  input: InfoTagType;
  value: string | number | undefined;
  onChange: (value: string) => void;
}

export function InfoInput({ input, value, onChange }: InfoInputProps) {
  // Ensure we always have a defined value to prevent controlled/uncontrolled input issues
  // For number inputs, default to 0; for text inputs, default to empty string
  const defaultValue = value ?? (input.options.type === 'number' ? 0 : '');

  // Use a local state to track input value
  const [localValue, setLocalValue] = useState(defaultValue);

  // Update local state when prop value changes
  useEffect(() => {
    setLocalValue(defaultValue);
  }, [defaultValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
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
