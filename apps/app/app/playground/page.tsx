'use client';

import parseMarkdocToInputs from '@/lib/parseMarkdocToInputs';
import TipTap from '@repo/design-system/components/editor/TipTap';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { ScrollArea } from '@repo/design-system/components/ui/scroll-area';
import { Switch } from '@repo/design-system/components/ui/switch';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import Inputs from '@repo/markdoc-md/render/inputs/Inputs';
import { Eye, FileText, Settings } from 'lucide-react';
import { useState } from 'react';
import { MemoizedCopySection } from '../aiscribe/_components/MemoizedCopySection';

export default function PlaygroundPage() {
  const [template, setTemplate] = useState(`# Beispiel Arztbericht

Patient: {% info "patient_name" %}
Alter: {% info "age" %}
Datum: {% info "date" %}

## Hauptbeschwerde
{% info "chief_complaint" %}

## Bewertung
{% info "assessment" %}

## Behandlungsplan
{% info "plan" %}

## Geschlecht
# Beispiel Arztbericht

## Geschlecht
{% switch "gender" %}
  {% case "male" %}Männlich{% /case %}
  {% case "female" %}Weiblich{% /case %}
  {% case "other" %}Divers{% /case %}
{% /switch %}`);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [useTipTap, setUseTipTap] = useState(false);

  // Handle values change from inputs
  const handleValuesChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  // Parse markdoc to get input tags
  const parsedInputs = parseMarkdocToInputs(template);

  return (
    <div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4">
      <div className="mx-auto max-w-full space-y-8">
        {/* Header Section */}
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="rounded-full bg-solarized-cyan/10 p-3">
              <FileText className="h-8 w-8 text-solarized-cyan" />
            </div>
            <div>
              <h1 className="font-bold text-3xl text-primary">
                Markdoc Spielwiese
              </h1>
              <p className="text-lg text-muted-foreground">
                Testen und Vorschau Ihrer Markdoc-Vorlagen mit interaktiven
                Eingabefeldern
              </p>
            </div>
          </div>
        </div>

        {/* 3-Column Layout - Equal Sizes */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Template Input */}
          <div className="lg:col-span-1">
            <Card className="h-fit border-solarized-blue/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-blue/5 to-solarized-cyan/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-foreground">
                    <FileText className="h-5 w-5 text-solarized-blue" />
                    Vorlage Eingabe
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        useTipTap ? 'text-muted-foreground' : 'text-foreground'
                      }
                    >
                      Text
                    </span>
                    <Switch
                      checked={useTipTap}
                      onCheckedChange={setUseTipTap}
                    />
                    <span
                      className={
                        useTipTap ? 'text-foreground' : 'text-muted-foreground'
                      }
                    >
                      Editor
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-[500px]">
                  {useTipTap ? (
                    <TipTap note={template} setContent={setTemplate} />
                  ) : (
                    <Textarea
                      placeholder="Geben Sie hier Ihre Markdoc-Vorlage mit info-Tags ein..."
                      className="h-full resize-none border-input bg-background font-mono text-foreground text-sm transition-all placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20"
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                    />
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplate('')}
                    className="w-full"
                  >
                    Vorlage löschen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Input Tags */}
          <div className="lg:col-span-1">
            <Card className="h-fit border-solarized-green/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  <Settings className="h-5 w-5 text-solarized-green" />
                  Interaktive Eingaben
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[500px] overflow-y-auto">
                  {parsedInputs.inputTags.length > 0 ? (
                    <div className="space-y-4">
                      <Inputs
                        inputTags={JSON.stringify(parsedInputs)}
                        onChange={handleValuesChange}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                      <Settings className="h-12 w-12" />
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg">
                          Keine Eingaben gefunden
                        </h3>
                        <p className="max-w-sm text-sm">
                          Fügen Sie info-Tags zu Ihrer Vorlage hinzu mit der
                          Syntax:
                          <br />
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {`{% info "feldname" %}`}
                          </code>
                        </p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Rendered Output */}
          <div className="lg:col-span-1">
            <Card className="h-fit border-solarized-cyan/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-cyan/5 to-solarized-green/5">
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  <Eye className="h-5 w-5 text-solarized-cyan" />
                  Gerenderte Ausgabe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[500px] rounded-lg border border-solarized-cyan/20 bg-background/50 p-4">
                  {template ? (
                    <MemoizedCopySection
                      title="Vorschau"
                      values={values}
                      content={template}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                      <Eye className="h-12 w-12" />
                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg">Keine Vorlage</h3>
                        <p className="max-w-sm text-sm">
                          Geben Sie eine Markdoc-Vorlage in der linken Spalte
                          ein, um die gerenderte Ausgabe hier zu sehen.
                        </p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Section */}
        <div className="rounded-lg border border-solarized-blue/20 bg-solarized-blue/10 p-4 text-sm">
          <h4 className="mb-2 font-semibold text-solarized-blue">
            Verwendung:
          </h4>
          <ul className="space-y-1 text-solarized-blue/80">
            <li>
              • Schreiben Sie Ihre Markdoc-Vorlage mit info-Tags in der linken
              Spalte
            </li>
            <li>
              • Füllen Sie die generierten Formularfelder in der mittleren
              Spalte aus
            </li>
            <li>
              • Sehen Sie das gerenderte Ergebnis mit Ihren Werten in der
              rechten Spalte
            </li>
            <li>
              • Info-Tag Syntax:{' '}
              <code className="rounded bg-solarized-blue/20 px-1">{`{% info "feld" %}`}</code>
            </li>
            <li>
              • Switch-Tag Syntax:{' '}
              <code className="rounded bg-solarized-blue/20 px-1">{`{% switch "variable" %}...{% /switch %}`}</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
