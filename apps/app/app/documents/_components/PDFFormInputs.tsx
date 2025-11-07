'use client';

import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useEffect, useState } from 'react';
import type { PDFField } from '../_lib/parsePDFFormFields';

interface PDFFormInputsProps {
  fields: PDFField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export default function PDFFormInputs({
  fields,
  values,
  onChange,
}: PDFFormInputsProps) {
  const [localValues, setLocalValues] = useState<Record<string, string>>(
    values
  );

  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  const handleInputChange = (name: string, value: string) => {
    const newValues = {
      ...localValues,
      [name]: value,
    };
    setLocalValues(newValues);
    onChange(newValues);
  };

  if (fields.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-center text-muted-foreground">
          Upload a PDF with form fields to get started
        </p>
      </div>
    );
  }

  return (
    <form className="w-full max-w-full space-y-6 pr-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Form Fields</h3>
        <p className="text-muted-foreground text-sm">
          Fill in the fields below to update the PDF
        </p>
      </div>
      {fields.map((field) => (
        <div className="w-full space-y-2" key={field.name}>
          <Label htmlFor={field.name}>{field.label || field.name}</Label>
          {field.type === 'text' && (
            <Input
              className="h-9 w-full"
              id={field.name}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.label || field.name}
              type="text"
              value={localValues[field.name] || ''}
            />
          )}
          {field.type === 'multiline' && (
            <Textarea
              className="w-full resize-none"
              id={field.name}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.label || field.name}
              rows={3}
              value={localValues[field.name] || ''}
            />
          )}
          {field.type === 'dropdown' && field.options && (
            <Select
              onValueChange={(value) => handleInputChange(field.name, value)}
              value={localValues[field.name] || ''}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field.type === 'checkbox' && (
            <div className="flex items-center gap-2">
              <input
                checked={localValues[field.name] === 'true'}
                className="h-4 w-4"
                id={field.name}
                onChange={(e) =>
                  handleInputChange(field.name, e.target.checked.toString())
                }
                type="checkbox"
              />
              <Label htmlFor={field.name}>{field.label || field.name}</Label>
            </div>
          )}
          {field.type === 'radio' && field.options && (
            <Select
              onValueChange={(value) => handleInputChange(field.name, value)}
              value={localValues[field.name] || ''}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </form>
  );
}
