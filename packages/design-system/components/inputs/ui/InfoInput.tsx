'use client';
import type { InfoInputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';


export interface InfoInputProps {
  input: InfoInputTagType;
  value: string | number | undefined;
  onChange: (value: string) => void;
}

export function InfoInput({ input, value, onChange }: InfoInputProps) {
  // Ensure we always have a defined value to prevent controlled/uncontrolled input issues
  // Use empty string as default for both text and number inputs
  const defaultValue = value ?? '';

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

  console.log(input);

  return (
    <div key={`info-${input.attributes.primary}`} className="*:not-first:mt-2">
      <Label htmlFor={input.attributes.primary}>
        {input.attributes.primary}
      </Label>
      <div className="flex rounded-md shadow-xs">
        <Input
          id={input.attributes.primary}
          name={input.attributes.primary}
          value={localValue}
          onChange={handleChange}
          type="text"
          placeholder={`Enter ${input.attributes.primary}`}
          className={`-me-px flex-1 ${input.attributes.unit ? 'rounded-e-none' : ''} shadow-none focus-visible:z-10`}
        />
        {input.attributes.unit && <span className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex items-center rounded-e-md border px-3 text-sm font-medium transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50">
          {input.attributes.unit}
        </span>}
      </div>
    </div>
  )}