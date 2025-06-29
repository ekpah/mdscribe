'use client';
import type { SwitchInputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
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

export function SwitchInput({
  input,
  value,
  onChange,
}: {
  input: SwitchInputTagType;
  value: string | undefined;
  onChange: (newValue: string) => void;
}) {
  const options = input.children?.filter(
    (caseTag) => caseTag.name === 'Case' && caseTag.attributes.primary
  );
  const useSelect = options && options.length > 3;

  // Use a local state to track input value
  const [localValue, setLocalValue] = useState(value || '');

  // Update local state when prop value changes
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="w-full max-w-full space-y-2" key={`switch-${input.attributes.primary}`}>
      <Label
        className="font-medium text-foreground"
        htmlFor={input.attributes.primary}
      >
        {input.attributes.primary}
      </Label>
      {useSelect ? (
        <Select
          name={input.attributes.primary}
          onValueChange={handleChange}
          value={localValue}
        >
          <SelectTrigger className="h-9 w-full max-w-full border-input bg-background text-foreground transition-all focus:border-solarized-blue focus:ring-solarized-blue/20">
            <SelectValue placeholder={`Select ${input.attributes.primary}`} />
          </SelectTrigger>
          <SelectContent className="border-input bg-background">
            {options?.map((caseTag) => (
              <SelectItem
                className="text-foreground hover:bg-solarized-blue/10 focus:bg-solarized-blue/10"
                key={caseTag.attributes.primary}
                value={caseTag.attributes.primary}
              >
                {caseTag.attributes.primary}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <ToggleGroup
          className="flex w-full max-w-full flex-row overflow-hidden rounded-md border border-input bg-background"
          onValueChange={handleChange}
          type="single"
          value={localValue}
        >
          {options?.map((caseTag) => (
            <ToggleGroupItem
              className="h-9 min-w-0 flex-1 rounded-none bg-transparent text-foreground transition-colors hover:bg-muted hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
              key={caseTag.attributes.primary}
              value={caseTag.attributes.primary}
            >
              {caseTag.attributes.primary}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
