'use client';

import Markdoc, { RenderableTreeNode } from '@markdoc/markdoc';
import TipTap from '@repo/design-system/components/editor/TipTap';
import Inputs from '@repo/design-system/components/inputs/Inputs';
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
import config from '@repo/markdoc-md/markdoc-config';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import {
  ChevronDown,
  ChevronRight,
  Code,
  Eye,
  FileText,
  Layers,
  Settings,
  TreePine,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { MemoizedCopySection } from '../aiscribe/_components/MemoizedCopySection';



// Collapsible Object Display component for AST and renderable tree
function ObjectDisplay({ data }: { data: unknown }) {
  return (
    <div className="font-mono text-xs">
      <ObjectNode data={data} name="" level={0} />
    </div>
  );
}

function ObjectNode({
  data,
  name,
  level,
}: {
  data: unknown;
  name: string;
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const indent = level * 16;

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  if (data === null) {
    return (
      <div style={{ marginLeft: indent }} className="text-solarized-orange">
        {name && <span className="text-solarized-blue">{name}: </span>}
        <span>null</span>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div style={{ marginLeft: indent }} className="text-solarized-orange">
        {name && <span className="text-solarized-blue">{name}: </span>}
        <span>undefined</span>
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div style={{ marginLeft: indent }} className="text-solarized-green">
        {name && <span className="text-solarized-blue">{name}: </span>}
        <span>"{data}"</span>
      </div>
    );
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return (
      <div style={{ marginLeft: indent }} className="text-solarized-orange">
        {name && <span className="text-solarized-blue">{name}: </span>}
        <span>{String(data)}</span>
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ marginLeft: indent }}>
          {name && <span className="text-solarized-blue">{name}: </span>}
          <span className="text-muted-foreground">[]</span>
        </div>
      );
    }

    return (
      <div>
        <button
          style={{ marginLeft: indent }}
          className="-mx-1 cursor-pointer select-none rounded px-1 text-left hover:bg-muted/50"
          onClick={toggleExpanded}
          type="button"
        >
          {isExpanded ? (
            <ChevronDown className="inline h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="inline h-3 w-3 text-muted-foreground" />
          )}
          {name && <span className="ml-1 text-solarized-blue">{name}: </span>}
          <span className="text-muted-foreground">
            [{data.length} {data.length === 1 ? 'item' : 'items'}]
          </span>
        </button>
        {isExpanded && (
          <div>
            {data.map((item, index) => (
              <ObjectNode
                key={index}
                data={item}
                name={`[${index}]`}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object' && data !== null) {
    const entries = Object.entries(data as Record<string, unknown>);

    if (entries.length === 0) {
      return (
        <div style={{ marginLeft: indent }}>
          {name && <span className="text-solarized-blue">{name}: </span>}
          <span className="text-muted-foreground">{'{}'}</span>
        </div>
      );
    }

    return (
      <div>
        <button
          style={{ marginLeft: indent }}
          className="-mx-1 cursor-pointer select-none rounded px-1 text-left hover:bg-muted/50"
          onClick={toggleExpanded}
          type="button"
        >
          {isExpanded ? (
            <ChevronDown className="inline h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="inline h-3 w-3 text-muted-foreground" />
          )}
          {name && <span className="ml-1 text-solarized-blue">{name}: </span>}
          <span className="text-muted-foreground">
            {`{${entries.length} ${entries.length === 1 ? 'key' : 'keys'}}`}
          </span>
        </button>
        {isExpanded && (
          <div>
            {entries.map(([key, value]) => (
              <ObjectNode key={key} data={value} name={key} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback for other types
  return (
    <div style={{ marginLeft: indent }} className="text-muted-foreground">
      {name && <span className="text-solarized-blue">{name}: </span>}
      <span>{String(data)}</span>
    </div>
  );
}

export default function PlaygroundPage() {
  const [template, setTemplate] = useState(`# Patient Score

Patient: {% info "patient_name" /%}
Alter: {% info "age" /%}

## Score Berechnung
{% score formula="[age]*2+[gender_score]*3+[diabetes]*2+[hypertension]*2+[heart_failure]*2+[vascular_disease]*2+[stroke]*2+[smoking]*1" unit="Punkte" /%}

{% info "age" label="Alter" type="number" /%}
{% info "gender" label="Geschlecht" type="select" options="male,female" /%}
{% info "diabetes" label="Diabetes mellitus" type="boolean" /%}
{% info "hypertension" label="Arterielle Hypertonie" type="boolean" /%}
{% info "heart_failure" label="Herzinsuffizienz" type="boolean" /%}
{% info "vascular_disease" label="Gefäßerkrankung" type="boolean" /%}
{% info "stroke" label="Schlaganfall/TIA" type="boolean" /%}
{% info "smoking" label="Rauchen" type="boolean" /%}

## Geschlecht
{% switch "gender" %}
  {% case "male" %}Männlich{% /case %}
  {% case "female" %}Weiblich{% /case %}
  {% case "other" %}Divers{% /case %}
{% /switch %}`);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [useTipTap, setUseTipTap] = useState(false);
  const [middleView, setMiddleView] = useState<'inputs' | 'json'>('inputs');
  const [rightView, setRightView] = useState<'preview' | 'ast' | 'transform'>(
    'preview'
  );

  // Handle values change from inputs
  const handleValuesChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  // Parse markdoc to get input tags
  const parsedInputs = parseMarkdocToInputs(template);

  // Markdoc parsing for AST and transform views
  const markdocData = useMemo(() => {
    try {
      const ast = Markdoc.parse(template);
      const content: RenderableTreeNode = Markdoc.transform(ast, config);
      return { ast, content };
    } catch (error) {
      console.error('Markdoc parsing error:', error);
      const errorAst = Markdoc.parse(`Error parsing template: ${error}`);
      return {
        ast: errorAst,
        content: Markdoc.transform(errorAst, config),
      };
    }
  }, [template]);

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
                Markdoc-MD Playground
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
            <Card className="h-[680px] border-solarized-blue/20 shadow-lg">
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
                    onClick={() =>
                      setTemplate(`# Beispiel Arztbericht

Patient: {% info "patient_name" /%}
Alter: {% info "age" /%}
Datum: {% info "date" /%}

## Hauptbeschwerde
{% info "chief_complaint" /%}

## Bewertung
{% info "assessment" /%}

## Behandlungsplan
{% info "plan" /%}

## Geschlecht
# Beispiel Arztbericht

## Geschlecht
{% switch "gender" %}
  {% case "male" %}Männlich{% /case %}
  {% case "female" %}Weiblich{% /case %}
  {% case "other" %}Divers{% /case %}
{% /switch %}`)
                    }
                    className="w-full"
                  >
                    Vorlage zurücksetzen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Input Tags / JSON */}
          <div className="lg:col-span-1">
            <Card className="h-[680px] border-solarized-green/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-green/5 to-solarized-blue/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-foreground">
                    <Settings className="h-5 w-5 text-solarized-green" />
                    {middleView === 'inputs'
                      ? 'Interaktive Eingaben'
                      : 'Input JSON'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={middleView === 'inputs' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMiddleView('inputs')}
                      className="h-8 px-3 text-xs"
                    >
                      <Settings className="mr-1 h-3 w-3" />
                      Inputs
                    </Button>
                    <Button
                      variant={middleView === 'json' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMiddleView('json')}
                      className="h-8 px-3 text-xs"
                    >
                      <Code className="mr-1 h-3 w-3" />
                      JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[552px] overflow-y-auto">
                  {middleView === 'inputs' ? (
                    parsedInputs.length > 0 ? (
                      <div className="space-y-4">
                        <Inputs
                          inputTags={parsedInputs}
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
                    )
                  ) : (
                    <div className="h-full">
                      {parsedInputs.length > 0 ? (
                        <ObjectDisplay data={parsedInputs} />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                          <Code className="h-12 w-12" />
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lg">
                              Keine Inputs zum Anzeigen
                            </h3>
                            <p className="max-w-sm text-sm">
                              Fügen Sie info-Tags zu Ihrer Vorlage hinzu, um das
                              JSON zu sehen.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Preview / AST / Transform */}
          <div className="lg:col-span-1">
            <Card className="h-[680px] border-solarized-cyan/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-solarized-cyan/5 to-solarized-green/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base text-foreground">
                    <Eye className="h-5 w-5 text-solarized-cyan" />
                    {rightView === 'preview'
                      ? 'Gerenderte Ausgabe'
                      : rightView === 'ast'
                        ? 'AST'
                        : 'Renderable Tree'}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={rightView === 'preview' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRightView('preview')}
                      className="h-8 px-2 text-xs"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      Preview
                    </Button>
                    <Button
                      variant={
                        rightView === 'transform' ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => setRightView('transform')}
                      className="h-8 px-2 text-xs"
                    >
                      <Layers className="mr-1 h-3 w-3" />
                      Tree
                    </Button>
                    <Button
                      variant={rightView === 'ast' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRightView('ast')}
                      className="h-8 px-2 text-xs"
                    >
                      <TreePine className="mr-1 h-3 w-3" />
                      AST
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[552px] rounded-lg border border-solarized-cyan/20 bg-background/50 p-4">
                  {(() => {
                    if (rightView === 'preview') {
                      if (!template) {
                        return (
                          <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                            <Eye className="h-12 w-12" />
                            <div className="space-y-2">
                              <h3 className="font-semibold text-lg">
                                Keine Vorlage
                              </h3>
                              <p className="max-w-sm text-sm">
                                Geben Sie eine Markdoc-Vorlage in der linken
                                Spalte ein, um die gerenderte Ausgabe hier zu
                                sehen.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <MemoizedCopySection
                          title="Vorschau"
                          values={values}
                          content={template}
                        />
                      );
                    }

                    if (rightView === 'ast') {
                      if (!template) {
                        return (
                          <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                            <TreePine className="h-12 w-12" />
                            <div className="space-y-2">
                              <h3 className="font-semibold text-lg">
                                Keine AST
                              </h3>
                              <p className="max-w-sm text-sm">
                                Geben Sie eine Markdoc-Vorlage ein, um den
                                Abstract Syntax Tree zu sehen.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return <ObjectDisplay data={markdocData.ast} />;
                    }

                    if (!template) {
                      return (
                        <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
                          <Layers className="h-12 w-12" />
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lg">
                              Kein Renderable Tree
                            </h3>
                            <p className="max-w-sm text-sm">
                              Geben Sie eine Markdoc-Vorlage ein, um den
                              renderable tree zu sehen.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return <ObjectDisplay data={markdocData.content} />;
                  })()}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info Section - Updated */}
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
              • Mittlere Spalte: Wechseln Sie zwischen Eingabefeldern und
              JSON-Darstellung
            </li>
            <li>
              • Rechte Spalte: Wechseln Sie zwischen Vorschau, AST und
              Renderable Tree
            </li>
            <li>
              • Info-Tag Syntax:{' '}
              <code className="rounded bg-solarized-blue/20 px-1">{`{% info "feld" /%}`}</code>
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
