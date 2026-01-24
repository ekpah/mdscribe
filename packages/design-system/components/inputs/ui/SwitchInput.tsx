'use client';
import type { SwitchInputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../ui/button';
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
  suggestedValue,
  suggestionLabel = 'Vorschlag',
  onAcceptSuggestedValue,
  inputClassName,
}: {
  input: SwitchInputTagType;
  value: string | undefined;
  onChange: (newValue: string) => void;
  suggestedValue?: string | number;
  suggestionLabel?: string;
  onAcceptSuggestedValue?: () => void;
  inputClassName?: string;
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

  const normalizedSuggestion =
    typeof suggestedValue === 'number' ? String(suggestedValue) : suggestedValue;
  const hasValue = localValue !== '';
  const hasSuggestion = Boolean(normalizedSuggestion && normalizedSuggestion !== '');
  const isSuggestionApplied =
    hasSuggestion && localValue === normalizedSuggestion;
  const shouldShowSuggestion = hasSuggestion && !isSuggestionApplied;

  const suggestionRow = shouldShowSuggestion ? (
    <div className="flex items-center justify-between gap-2 rounded-md border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-1 text-xs text-solarized-orange">
      <div className="flex min-w-0 items-center gap-2">
        <Bot aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="font-medium">{suggestionLabel}</span>
        <span className="truncate text-solarized-orange/90">
          {normalizedSuggestion}
        </span>
      </div>
      {onAcceptSuggestedValue && (
        <Button
          className="h-6 px-2 text-xs"
          onClick={onAcceptSuggestedValue}
          size="sm"
          type="button"
          variant="ghost"
        >
          {hasValue ? 'Ersetzen' : 'Uebernehmen'}
        </Button>
      )}
    </div>
  ) : null;

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
          <SelectTrigger
            className={cn(
              'h-9 w-full max-w-full border-input bg-background text-foreground transition-all focus:border-solarized-blue focus:ring-solarized-blue/20',
              inputClassName
            )}
          >
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
          className={cn(
            'flex w-full max-w-full flex-row overflow-hidden rounded-md border border-input bg-background',
            inputClassName
          )}
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
      {suggestionRow}
    </div>
  );
}
