'use client';
import { useEffect, useState } from 'react';
import { Label } from '../../../ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/components/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../ui/components/toggle-group';
import type { BaseTagType } from '../Inputs';

export type CaseTagType = {
  type: 'case';
  options: { name: string };
};

export type SwitchTagType = BaseTagType & {
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
    <div key={`switch-${input.options.name}`} className="space-y-2">
      <Label
        htmlFor={input.options.name}
        className="font-medium text-foreground"
      >
        {input.options.name}
      </Label>
      {useSelect ? (
        <Select
          name={input.options.name}
          value={localValue}
          onValueChange={handleChange}
        >
          <SelectTrigger className="h-9 border-input bg-background text-foreground transition-all focus:border-solarized-blue focus:ring-solarized-blue/20">
            <SelectValue placeholder={`Select ${input.options.name}`} />
          </SelectTrigger>
          <SelectContent className="border-input bg-background">
            {options?.map((caseTag) => (
              <SelectItem
                key={caseTag.options.name}
                value={caseTag.options.name}
                className="text-foreground hover:bg-solarized-blue/10 focus:bg-solarized-blue/10"
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
          className="flex flex-row overflow-hidden rounded-md border border-input bg-background"
        >
          {options?.map((caseTag) => (
            <ToggleGroupItem
              key={caseTag.options.name}
              value={caseTag.options.name}
              className="h-9 flex-1 rounded-none bg-secondary text-foreground transition-colors hover:bg-solarized-blue/10 data-[state=on]:bg-secondary-foreground data-[state=on]:text-secondary"
            >
              {caseTag.options.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
