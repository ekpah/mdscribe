'use client';
import type { CaseInputTagType, SwitchInputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { useEffect, useState } from 'react';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';





export interface SwitchInputProps {
  input: SwitchInputTagType;
  value: string | undefined;
  onValueChange: (value: string) => void;
}

export function SwitchInput({ input, value, onValueChange }: SwitchInputProps) {
  const options = input.children?.filter((caseTag) => caseTag.name === 'Case' && caseTag.attributes.primary);
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
    <div key={`switch-${input.attributes.primary}`} className="space-y-2">
      <Label
        htmlFor={input.attributes.primary}
        className="font-medium text-foreground"
      >
        {input.attributes.primary}
      </Label>
      {useSelect ? (
        <Select
          name={input.attributes.primary}
          value={localValue}
          onValueChange={handleChange}
        >
          <SelectTrigger className="h-9 border-input bg-background text-foreground transition-all focus:border-solarized-blue focus:ring-solarized-blue/20">
            <SelectValue placeholder={`Select ${input.attributes.primary}`} />
          </SelectTrigger>
          <SelectContent className="border-input bg-background">
            {options?.map((caseTag) => (
              <SelectItem
                key={caseTag.attributes.primary}
                value={caseTag.attributes.primary}
                className="text-foreground hover:bg-solarized-blue/10 focus:bg-solarized-blue/10"
              >
                {caseTag.attributes.primary}
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
              key={caseTag.attributes.primary}
              value={caseTag.attributes.primary}
              className="h-9 flex-1 rounded-none bg-transparent text-foreground transition-colors hover:bg-muted hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              {caseTag.attributes.primary}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
