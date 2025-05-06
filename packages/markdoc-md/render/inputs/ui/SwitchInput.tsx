'use client';

import { Card } from '@repo/design-system/components/ui/card';
import { Label } from '@repo/design-system/components/ui/label';
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
import { useEffect, useState } from 'react';

export type CaseTagType = {
  type: 'case';
  options: { name: string };
};

export type SwitchTagType = {
  type: 'switch';
  options: { name: string };
  children: CaseTagType[];
};

export interface SwitchInputProps {
  input: SwitchTagType;
  value: string | undefined;
  onValueChange: (value: string) => void;
}

export function SwitchInput({ input, value, onValueChange }: SwitchInputProps) {
  const options = input.children?.filter((caseTag) => caseTag.options.name);
  const useSelect = options && options.length > 3;

  // Use a local state to track input value
  const [localValue, setLocalValue] = useState(value || '');

  // Update local state when prop value changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onValueChange(newValue);
  };

  return (
    <Card
      key={`switch-${input.options.name}`}
      className="m-4 bg-secondary p-4 focus-within:border-secondary focus-within:ring-2"
    >
      <div className="space-y-3">
        <Label htmlFor={input.options.name}>{input.options.name}</Label>
        {useSelect ? (
          <Select
            name={input.options.name}
            value={localValue}
            onValueChange={handleChange}
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
            value={localValue}
            onValueChange={handleChange}
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
      </div>
    </Card>
  );
}
