'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { FileText, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import type { FieldValues } from 'react-hook-form';
import type { ICUFormData } from '../page';

interface PatientInputSectionProps {
  formData: ICUFormData;
  onInputChange: (value: string) => void;
  onFormChange: (data: FieldValues) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PatientInputSection({
  formData,
  onInputChange,
  onFormChange,
  onGenerate,
  isGenerating,
}: PatientInputSectionProps) {
  useEffect(() => {
    onFormChange(formData);
  }, [formData, onFormChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '1') {
      e.preventDefault();
      document.getElementById('patient-notes')?.focus();
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-foreground">Patientennotizen</CardTitle>
        <CardDescription>
          Dokumentieren Sie den Zustand und die Behandlung des Patienten während
          des ICU-Aufenthalts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          id="patient-notes"
          placeholder="Geben Sie hier Ihre Notizen zum Patienten ein..."
          className="min-h-[300px] resize-none border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue"
          value={formData.notes}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-muted-foreground text-sm">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            ⌘⇧1
          </kbd>{' '}
          für Fokus
        </div>
        <Button
          onClick={onGenerate}
          disabled={isGenerating || !formData.notes.trim()}
          className="bg-solarized-blue text-solarized-base3 hover:bg-solarized-blue/90"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generiere...
            </>
          ) : (
            <>
              <FileText className="mr-2 size-4" />
              Zusammenfassung generieren
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
