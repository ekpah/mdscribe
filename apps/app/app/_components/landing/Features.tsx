import SmartCompletion from '@/public/landing/SmartCompletion';
import TemplateLibrary from '@/public/landing/TemplateLibrary';
import { DynamicMarkdocRenderer, parseMarkdocToInputs } from '@repo/markdoc-md';
import Inputs from '@repo/markdoc-md/render/inputs/Inputs';
import { BrainCircuitIcon, FileTextIcon, SparkleIcon } from 'lucide-react';
import { useState } from 'react';

export default function Features() {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const handleValuesChange = (data: Record<string, unknown>) => {
    setValues(data);
  };

  const sampleMarkdocContent = `
Die notfallmäßige stationäre Aufnahme von {% switch "Geschlecht" %}{% case %}[#Herrn/Frau#]{%/case%}{% case "männlich" %}Herrn{%/case%}{% case "weiblich" %}Frau{%/case%}{%/switch%}{% info "Nachnahme" /%} erfolgte bei kardialer Dekompensation.

[...]

Wir bitten um tägliche Gewichtskontrollen und bei einer Gewichtszunahme um eine zeitnahe Rücksprache mit dem behandelnden Hausarzt.

Wir bitten im weiteren ambulanten Verlauf um die engmaschige Kontrolle und die strenge Einstellung der kardiovaskulären Risikofaktoren sowie ggf. um die Optimierung der medikamentösen Therapie.

Wir entlassen {% switch "Geschlecht" %}{% case "undefined" %}[#Herrn/Frau#]{%/case%}{% case "männlich" %}Herrn{%/case%}{% case "weiblich" %}Frau{%/case%}{%/switch%}{% info "Nachnahme" /%} in internistisch stabilem Allgemeinzustand in Ihre geschätzte haus- und fachärztliche Betreuung und stehen bei Rückfragen gerne zur Verfügung.
`;

  const sampleInputTags = parseMarkdocToInputs(sampleMarkdocContent);

  return (
    <section className="py-8">
      <div className="container m-8 mx-auto max-w-5xl">
        <h1 className="my-2 w-full text-center font-bold text-5xl leading-tight">
          Features
        </h1>
        <div className="mb-4 w-full">
          <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
        </div>
        <div className="flex flex-wrap">
          <div className="w-5/6 p-6 sm:w-1/2">
            <h3 className="mb-3 font-bold text-3xl leading-none">
              Baustein-Bibliothek
            </h3>
            <p className="mb-8 text-xl">
              Eine Sammlung von Textbausteinen ist verfügbar, damit du direkt
              loslegen kannst.
            </p>
          </div>
          <div className="w-full p-6 sm:w-1/2">
            <TemplateLibrary />
          </div>
        </div>
        <div className="flex flex-col-reverse flex-wrap sm:flex-row">
          <div className="mt-6 w-full p-6 sm:w-1/2">
            <SmartCompletion />
          </div>
          <div className="mt-6 w-full p-6 sm:w-1/2">
            <div className="align-middle">
              <h3 className="mb-3 font-bold text-3xl leading-none">
                Schlaue Anpassung
              </h3>
              <p className="mb-8 text-xl">
                Ohne viel manuelles Schreiben lassen sich die Textbausteine an
                die üblichsten Situation anpassen, damit du schnell zur fertigen
                Epikrise kommst.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* AI Note-to-Summary Feature Section - Enhanced Styling */}
      <div className="container mx-auto mt-12 max-w-5xl rounded-xl py-16 sm:py-20">
        <h2 className="mb-10 text-center font-bold text-4xl text-foreground leading-tight sm:text-5xl">
          Von Notizen zu{' '}
          <span className="text-[var(--color-solarized-green)]">
            KI-gestützten Anamnesen
          </span>
        </h2>
        <div className="flex flex-col items-start justify-center gap-8 sm:flex-row sm:items-center sm:gap-10">
          {/* Left Column: Title + Raw Note Card */}
          <div className="flex w-full flex-1 flex-col items-center sm:w-auto">
            <span className="mb-3 text-center font-semibold text-lg text-muted-foreground">
              Deine Notiz
            </span>
            <div className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-6 shadow-lg transition-shadow">
              <div className="flex-1 whitespace-pre-line font-mono text-base text-foreground sm:text-lg">
                dyspnoe, fieber, husten seit 3 tagne, keine schmerzen insb.
                keine ap. fieber aktuell 38,9°C, 120/90, spo2 99, puls 70.
                husten mit gelblichem auswurf
              </div>
            </div>
          </div>

          {/* Center Column: Fancier Conversion Visual (Desktop only) */}
          <div className="hidden flex-col items-center justify-center self-center pt-12 sm:flex">
            <BrainCircuitIcon
              className="h-16 w-16 text-[var(--color-solarized-green)]/90 drop-shadow-[0_0_8px_hsl(68_100%_30%_/_0.5)]"
              strokeWidth={1.5}
            />
          </div>

          {/* Right Column: Title + AI Enhanced Card */}
          <div className="flex w-full flex-1 flex-col items-center sm:w-auto">
            <div className="mb-3 flex w-full items-start justify-between">
              <span className="font-semibold text-foreground text-lg">
                [J18.9]: Pneumonie
              </span>

              <span className="flex items-center gap-1 rounded-full bg-solarized-green/10 px-2.5 py-1 font-medium text-sm text-solarized-green">
                <SparkleIcon className="h-4 w-4" />
                KI-Zusammenfassung
              </span>
            </div>
            <div className="relative flex h-full w-full flex-col rounded-xl border border-solarized-green/50 bg-solarized-green/5 p-6 shadow-solarized-green/25 shadow-xl dark:border-solarized-green/70 dark:bg-slate-800/50">
              <div className="flex-1 text-base text-foreground sm:text-lg">
                <p className="mb-2">
                  Der Patient stellt sich akut in der Zentralen Notaufnahme mit
                  Dyspnoe, Fieber und produktivem Husten vor, am ehesten bei
                  Verdacht auf einen respiratorischen Infekt.
                </p>
                <p className="mb-2">
                  Der Patient berichtet über seit drei Tagen bestehende Atemnot
                  (Dyspnoe), begleitet von Husten mit gelblichem Auswurf. Die
                  Symptome haben sich über diesen Zeitraum kontinuierlich
                  entwickelt, ohne Hinweise auf eine Besserungstendenz.
                </p>
                <p className="mb-2">
                  Als Begleitsymptome gibt der Patient Fieber an. Relevante
                  Negativbefunde umfassen das Fehlen von Schmerzen, insbesondere
                  keine Angina pectoris-Beschwerden.
                </p>
                <p>
                  <b>Vitalparameter bei Vorstellung:</b> Blutdruck: 120/90 mmHg;
                  Herzfrequenz: 70/min; SpO2: 99%; Temperatur: 38,9°C
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Template Customization Feature Section */}
      <div className="container mx-auto mt-24 max-w-5xl rounded-xl py-16 sm:py-20">
        <h2 className="mb-10 text-center font-bold text-4xl text-foreground leading-tight sm:text-5xl">
          Flexible Vorlagen,{' '}
          <span className="text-[var(--color-solarized-blue)]">
            dynamisch angepasst
          </span>
        </h2>
        <div className="flex flex-col items-start justify-center gap-8 sm:flex-row sm:items-center sm:gap-10">
          {/* Left Column: Customizable Template Card */}
          <div className="flex w-full flex-1 flex-col items-center sm:w-auto">
            <span className="mb-3 text-center font-semibold text-lg text-muted-foreground">
              Anpassbare Vorlage
            </span>
            <div className="flex h-full w-full flex-col rounded-xl border border-border bg-card p-6 shadow-lg transition-shadow">
              <Inputs
                inputTags={JSON.stringify(sampleInputTags)}
                onChange={handleValuesChange}
              />
            </div>
          </div>

          {/* Center Column: Conversion Visual (Desktop only) */}
          <div className="hidden flex-col items-center justify-center self-center pt-12 sm:flex">
            <FileTextIcon
              className="h-16 w-16 text-[var(--color-solarized-blue)]/90 drop-shadow-[0_0_8px_hsl(205_69%_49%_/_0.5)]"
              strokeWidth={1.5}
            />
          </div>

          {/* Right Column: Rendered Note Card */}
          <div className="flex w-full flex-1 flex-col items-center sm:w-auto">
            <div className="mb-3 flex w-full items-start justify-between">
              <span className="font-semibold text-foreground text-lg">
                Gerenderte Notiz
              </span>
              <span className="flex items-center gap-1 rounded-full bg-solarized-blue/10 px-2.5 py-1 font-medium text-sm text-solarized-blue">
                <SparkleIcon className="h-4 w-4" />
                Dynamischer Inhalt
              </span>
            </div>
            <div className="relative flex h-full w-full flex-col rounded-xl border border-solarized-blue/50 bg-solarized-blue/5 p-6 shadow-solarized-blue/25 shadow-xl dark:border-solarized-blue/70 dark:bg-slate-800/50">
              <div className="prose dark:prose-invert flex-1 text-base text-foreground sm:text-lg">
                <DynamicMarkdocRenderer
                  variables={values}
                  markdocContent={sampleMarkdocContent}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
