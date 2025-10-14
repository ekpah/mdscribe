'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/design-system/components/ui/accordion';
import { Badge } from '@repo/design-system/components/ui/badge';
import { Card } from '@repo/design-system/components/ui/card';
import { ScrollArea } from '@repo/design-system/components/ui/scroll-area';
import { Separator } from '@repo/design-system/components/ui/separator';
import {
  BookOpen,
  Braces,
  Code2,
  Info,
  ListTree,
  Sparkles,
} from 'lucide-react';

export function EditorSidebar() {
  return (
    <Card className="h-full p-4">
      <ScrollArea className="h-full">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-solarized-blue" />
              <h3 className="font-semibold text-lg">Editor-Hilfe</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Nutzen Sie Tags und KI-Platzhalter für dynamische Templates
            </p>
          </div>

          <Separator />

          {/* AI Guidance Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-solarized-violet" />
              <h4 className="font-semibold text-sm">KI-Anleitung</h4>
            </div>
            
            <div className="space-y-3 rounded-lg bg-solarized-violet/5 p-3">
              {/* Square Brackets */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-solarized-violet bg-solarized-violet/10 font-mono text-solarized-violet text-xs"
                  >
                    [...]
                  </Badge>
                  <span className="font-medium text-xs">Platzhalter</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Eckige Klammern kennzeichnen{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    [Platzhalter]
                  </code>{' '}
                  für die KI. Diese werden in AI Scribe ersetzt und sind beim
                  Kopieren sichtbar.
                </p>
                <div className="mt-2 rounded border border-solarized-violet/20 bg-background p-2">
                  <p className="font-mono text-muted-foreground text-xs">
                    Beispiel: Der Patient [Name] zeigt [Symptome]
                  </p>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Double Brackets */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-solarized-violet bg-solarized-violet/10 font-mono text-solarized-violet text-xs"
                  >
                    ((…))
                  </Badge>
                  <span className="font-medium text-xs">KI-Hinweise</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Doppelte Klammern fügen{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    ((Hinweise))
                  </code>{' '}
                  für die KI hinzu. Diese sind ausgegraut sichtbar, werden aber
                  beim Kopieren entfernt.
                </p>
                <div className="mt-2 rounded border border-solarized-violet/20 bg-background p-2">
                  <p className="font-mono text-muted-foreground text-xs">
                    Beispiel: ((Beschreibe den Befund detailliert))
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags Accordion */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-solarized-green" />
              <h4 className="font-semibold text-sm">Verfügbare Tags</h4>
            </div>

            <Accordion className="w-full" type="single" collapsible>
              {/* Info Tag */}
              <AccordionItem value="info">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-solarized-blue text-xs">Info</Badge>
                    <span className="text-xs">Informations-Tag</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3 pt-1">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Zeigt wichtige Informationen oder Hinweise im Template an.
                  </p>
                  <div className="rounded bg-muted p-2">
                    <p className="font-mono text-xs">
                      <span className="text-solarized-blue">
                        {'{% info primary="Titel" %}'}
                      </span>
                      <br />
                      Inhalt der Information
                      <br />
                      <span className="text-solarized-blue">
                        {'{% /info %}'}
                      </span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Switch Tag */}
              <AccordionItem value="switch">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-solarized-green text-xs">Switch</Badge>
                    <span className="text-xs">Bedingungs-Tag</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3 pt-1">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Erstellt bedingte Inhalte basierend auf einer Variable.
                    Nützlich für verschiedene Patientengruppen oder Szenarien.
                  </p>
                  <div className="rounded bg-muted p-2">
                    <p className="font-mono text-xs">
                      <span className="text-solarized-green">
                        {'{% switch "geschlecht" %}'}
                      </span>
                      <br />
                      <span className="ml-2 text-blue-500">
                        {'{% case "männlich" %}'}
                      </span>
                      <span className="text-muted-foreground">Herr</span>
                      <span className="text-blue-500">{'{% /case %}'}</span>
                      <br />
                      <span className="ml-2 text-blue-500">
                        {'{% case "weiblich" %}'}
                      </span>
                      <span className="text-muted-foreground">Frau</span>
                      <span className="text-blue-500">{'{% /case %}'}</span>
                      <br />
                      <span className="text-solarized-green">
                        {'{% /switch %}'}
                      </span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Case Tag */}
              <AccordionItem value="case">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500 text-xs">Case</Badge>
                    <span className="text-xs">Fall-Tag (in Switch)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3 pt-1">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Definiert einen einzelnen Fall innerhalb eines Switch-Tags.
                    Wird nur innerhalb von Switch verwendet.
                  </p>
                  <div className="rounded bg-muted p-2">
                    <p className="font-mono text-xs">
                      <span className="text-blue-500">
                        {'{% case "wert" %}'}
                      </span>
                      <span className="text-muted-foreground">
                        Inhalt für diesen Fall
                      </span>
                      <span className="text-blue-500">{'{% /case %}'}</span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Score Tag */}
              <AccordionItem value="score">
                <AccordionTrigger className="py-2 text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-solarized-orange text-xs">Score</Badge>
                    <span className="text-xs">Berechnungs-Tag</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3 pt-1">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Berechnet und zeigt Scores oder Formelergebnisse an.
                  </p>
                  <div className="rounded bg-muted p-2">
                    <p className="font-mono text-xs">
                      <span className="text-solarized-orange">
                        {'{% score formula="a+b" unit="Punkte" %}'}
                      </span>
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Separator />

          {/* Quick Tips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTree className="h-4 w-4 text-solarized-cyan" />
              <h4 className="font-semibold text-sm">Schnelltipps</h4>
            </div>
            <ul className="space-y-1.5 text-muted-foreground text-xs">
              <li className="flex items-start gap-2">
                <span className="text-solarized-cyan">•</span>
                <span>
                  Verwenden Sie <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/</kbd> für
                  Schnellbefehle
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-solarized-cyan">•</span>
                <span>Klicken Sie auf Tags, um sie zu bearbeiten</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-solarized-cyan">•</span>
                <span>
                  Nutzen Sie "Show Source" um den Markdoc-Code direkt zu sehen
                </span>
              </li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
