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
import { Checkbox } from '@repo/design-system/components/ui/checkbox';
import { Label } from '@repo/design-system/components/ui/label';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { FileText, Loader2 } from 'lucide-react';
import type { DiagnosticProcedure } from '../page';

interface DiagnosticRequestsSectionProps {
  procedures: DiagnosticProcedure[];
  selectedProcedures: string[];
  additionalNotes: string;
  onAdditionalNotesChange: (value: string) => void;
  isGenerating: boolean;
  requests: string | undefined;
  onProcedureToggle: (procedureId: string) => void;
  onGenerate: () => void;
  onClearSelection: () => void;
}

export function DiagnosticRequestsSection({
  procedures,
  selectedProcedures,
  additionalNotes,
  onAdditionalNotesChange,
  isGenerating,
  requests,
  onProcedureToggle,
  onGenerate,
  onClearSelection,
}: DiagnosticRequestsSectionProps) {
  const categories = Array.from(
    new Set(procedures.map((proc) => proc.category))
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-foreground">
          Diagnostische Verfahren
        </CardTitle>
        <CardDescription>
          Wählen Sie die benötigten diagnostischen Verfahren für den Patienten
          aus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <h3 className="font-medium text-foreground">{category}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {procedures
                .filter((proc) => proc.category === category)
                .map((procedure) => (
                  <div
                    key={procedure.id}
                    className="flex items-start space-x-2"
                  >
                    <Checkbox
                      id={procedure.id}
                      checked={selectedProcedures.includes(procedure.id)}
                      onCheckedChange={() => onProcedureToggle(procedure.id)}
                      className="data-[state=checked]:border-solarized-blue data-[state=checked]:bg-solarized-blue"
                    />
                    <div className="grid gap-1.5">
                      <Label
                        htmlFor={procedure.id}
                        className="font-medium text-foreground"
                      >
                        {procedure.name}
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        {procedure.description}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <Label htmlFor="additional-notes" className="text-foreground">
            Zusätzliche Anmerkungen
          </Label>
          <Textarea
            id="additional-notes"
            placeholder="Geben Sie hier zusätzliche Informationen oder spezifische Anforderungen ein..."
            className="min-h-[100px] border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue"
            value={additionalNotes}
            onChange={(e) => onAdditionalNotesChange(e.target.value)}
          />
        </div>

        {requests && (
          <div className="space-y-2">
            <h4 className="font-medium text-foreground">
              Generierte Anforderungen
            </h4>
            <div className="rounded-md border bg-muted/50 p-4">
              <div className="whitespace-pre-wrap text-foreground text-sm">
                {requests}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground text-sm">
            {selectedProcedures.length} Verfahren ausgewählt
          </div>
          {selectedProcedures.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              Auswahl löschen
            </Button>
          )}
        </div>
        <Button
          onClick={onGenerate}
          disabled={isGenerating || selectedProcedures.length === 0}
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
              Anfragen generieren
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
