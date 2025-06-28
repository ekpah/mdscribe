'use client';
import { DateFormatter, DateValue, getLocalTimeZone, parseDate } from '@internationalized/date';
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


export type InfoValue = string | number | DateValue | undefined;

export function InfoInput({ input, value, onChange }: { input: InfoInputTagType, value: InfoValue, onChange: (value: string) => void }) {
  // Always call all hooks at the top level
  const [dateValue, setDateValue] = useState(parseDate("2025-01-01"));

  // Ensure we always have a defined value to prevent controlled/uncontrolled input issues
  const defaultValue = value ?? '';
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
      <div key={`info-${input.attributes.primary}`} className="*:not-first:mt-2">
        <DatePicker className="*:not-first:mt-2" value={dateValue}
          onChange={(value) => {
            if (value) {
              setDateValue(value);
              onChange(dateFormatter.format(value.toDate(getLocalTimeZone())));
            }
          }}>
          <Label className="text-foreground text-sm font-medium">{input.attributes.primary}</Label>
          <div className="flex">
            <Group className="w-full">
              <DateInput className="pe-9" />
            </Group>
            <Button className="text-muted-foreground/80 hover:text-foreground data-focus-visible:border-ring data-focus-visible:ring-ring/50 z-10 -ms-9 -me-px flex w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none data-focus-visible:ring-[3px]">
              <CalendarIcon size={16} />
            </Button>
          </div>
          <Popover
            className="bg-background text-popover-foreground data-entering:animate-in data-exiting:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0 data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 rounded-lg border shadow-lg outline-hidden"
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };
  // Handle number input type
  if (input.attributes.type === 'number') {
    return (
      <div key={`info-${input.attributes.primary}`} className="*:not-first:mt-2">
        <Label htmlFor={input.attributes.primary}>
          {input.attributes.primary}
        </Label>
        <div className="flex rounded-md shadow-xs">
          <Input
            id={input.attributes.primary}
            name={input.attributes.primary}
            value={localValue as string}
            onChange={handleChange}
            type="text"
            ref={withMask("999999", {
              placeholder: "",
              showMaskOnHover: false,
            })}
            placeholder={`Enter ${input.attributes.primary}`}
            className={`-me-px flex-1 ${input.attributes.unit ? 'rounded-e-none' : ''} shadow-none focus-visible:z-10`}
          />
          {input.attributes.unit && <span className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex items-center rounded-e-md border px-3 text-sm font-medium transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50">
            {input.attributes.unit}
          </span>}
        </div>
      </div>
    );
  }



  return (
    <div key={`info-${input.attributes.primary}`} className="*:not-first:mt-2">
      <Label htmlFor={input.attributes.primary}>
        {input.attributes.primary}
      </Label>
      <div className="flex rounded-md shadow-xs">
        <Input
          id={input.attributes.primary}
          name={input.attributes.primary}
          value={localValue as string}
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
  );
}