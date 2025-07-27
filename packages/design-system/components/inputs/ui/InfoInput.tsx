'use client';
import {
  DateFormatter,
  type DateValue,
  getLocalTimeZone,
  parseDate,
} from '@internationalized/date';
import type { InfoInputTagType } from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { CalendarIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';

import {
  Button,
  DatePicker,
  Dialog,
  Group,
  Popover,
} from 'react-aria-components';
import { withMask } from 'use-mask-input';
import { Calendar } from '../../ui/calendar-rac';
import { DateInput } from '../../ui/datefield-rac';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

type InfoValue = string | number | DateValue | undefined;

export function InfoInput({
  input,
  value,
  onChange,
}: {
  input: InfoInputTagType;
  value: InfoValue;
  onChange: (localValue: string | number) => void;
}) {
  // Always call all hooks at the top level
  const [dateValue, setDateValue] = useState(parseDate(new Date().toISOString().split('T')[0]));

  // Ensure we always have a defined value to prevent controlled/uncontrolled input issues
  const defaultValue =
    input.attributes.type === 'number' ? (value ?? 0) : (value ?? '');
  const [localValue, setLocalValue] = useState(defaultValue);

  // Update local state when prop value changes
  useEffect(() => {
    setLocalValue(defaultValue);
  }, [defaultValue]);

  const dateFormatter = new DateFormatter('de-DE', {
    dateStyle: 'short',
  });

  // Handle date input type
  if (input.attributes.type === 'date') {
    return (
      <div
        className="w-full max-w-full *:not-first:mt-2"
        key={`info-${input.attributes.primary}`}
      >
        <DatePicker
          aria-label={`${input.attributes.primary} calendar`}
          className="*:not-first:mt-2"
          onChange={(newDateValue) => {
            if (newDateValue) {
              setDateValue(newDateValue);
              onChange(
                dateFormatter.format(newDateValue.toDate(getLocalTimeZone()))
              );
            }
          }}
          value={dateValue}
        >
          <Label className="font-medium text-foreground text-sm">
            {input.attributes.primary}
          </Label>
          <div className="flex">
            <Group className="w-full">
              <DateInput className="pe-9" />
            </Group>
            <Button
              aria-label="Open calendar"
              className="-ms-9 -me-px z-10 flex w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground data-focus-visible:border-ring data-focus-visible:ring-[3px] data-focus-visible:ring-ring/50"
            >
              <CalendarIcon size={16} />
            </Button>
          </div>
          <Popover
            className="data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 rounded-lg border bg-background text-popover-foreground shadow-lg outline-hidden data-entering:animate-in data-exiting:animate-out"
            offset={4}
          >
            <Dialog className="max-h-[inherit] overflow-auto p-2">
              <Calendar />
            </Dialog>
          </Popover>
        </DatePicker>
      </div>
    );
  }
  // Handle text/number inputs
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(
      Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value)
    );
    onChange(Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value));
  };
  // Handle number input type
  if (input.attributes.type === 'number') {
    return (
      <div
        className="w-full max-w-full *:not-first:mt-2"
        key={`info-${input.attributes.primary}`}
      >
        <Label htmlFor={input.attributes.primary}>
          {input.attributes.primary}
        </Label>
        <div className="flex w-full max-w-full rounded-md shadow-xs">
          <Input
            className={`-me-px min-w-0 flex-1 ${input.attributes.unit ? 'rounded-e-none' : ''} shadow-none focus-visible:z-10`}
            id={input.attributes.primary}
            name={input.attributes.primary}
            onChange={handleNumberChange}
            placeholder={`Enter ${input.attributes.primary}`}
            ref={withMask('999999', {
              placeholder: '',
              showMaskOnHover: false,
            })}
            type="text"
            value={localValue as number}
          />
          {input.attributes.unit && (
            <span className="inline-flex items-center rounded-e-md border border-input bg-background px-3 font-medium text-foreground text-sm outline-none transition-[color,box-shadow] focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
              {input.attributes.unit}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Handle text/number inputs
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };
  return (
    <div
      className="w-full max-w-full *:not-first:mt-2"
      key={`info-${input.attributes.primary}`}
    >
      <Label htmlFor={input.attributes.primary}>
        {input.attributes.primary}
      </Label>
      <div className="flex w-full max-w-full rounded-md shadow-xs">
        <Input
          className={`-me-px min-w-0 flex-1 ${input.attributes.unit ? 'rounded-e-none' : ''} shadow-none focus-visible:z-10`}
          id={input.attributes.primary}
          name={input.attributes.primary}
          onChange={handleTextChange}
          placeholder={`Enter ${input.attributes.primary}`}
          type="text"
          value={localValue as string}
        />
        {input.attributes.unit && (
          <span className="inline-flex items-center rounded-e-md border border-input bg-background px-3 font-medium text-foreground text-sm outline-none transition-[color,box-shadow] focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50">
            {input.attributes.unit}
          </span>
        )}
      </div>
    </div>
  );
}
