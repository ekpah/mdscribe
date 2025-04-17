import { Button } from '@repo/design-system/components/ui/button';
import { Brain, FileText, Sparkles, Stethoscope } from 'lucide-react';
import Link from 'next/link';

export default function AIFeatures() {
  return (
    <section className="py-12">
      <div className="container mx-auto max-w-5xl">
        <h1 className="my-2 w-full text-center font-bold text-5xl leading-tight">
          KI-Unterstützung
        </h1>
        <div className="mb-4 w-full">
          <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
        </div>
        <p className="mb-8 text-center text-xl">
          Mit unseren KI-Funktionen erstellst du Arztbriefe schneller und
          präziser
        </p>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center">
              <Brain className="mr-3 size-8 text-primary" />
              <h3 className="font-bold text-2xl">Anamnese</h3>
            </div>
            <p className="mb-4">
              Gib deine Notizen ein und unsere KI strukturiert automatisch eine
              vollständige Anamnese für deinen Arztbrief.
            </p>
            <ul className="mb-6 space-y-2">
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>
                  Automatische Strukturierung nach medizinischen Standards
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>
                  Übersichtliche Gliederung der Patienteninformationen
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>Zeitersparnis bei der Dokumentation</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center">
              <FileText className="mr-3 size-8 text-primary" />
              <h3 className="font-bold text-2xl">
                Anforderungen für Untersuchungen
              </h3>
            </div>
            <p className="mb-4">
              Basierend auf der Anamnese generiert die KI passende
              Untersuchungsanforderungen und Fragestellungen für den weiteren
              Behandlungsverlauf.
            </p>
            <ul className="mb-6 space-y-2">
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>Vorlagen für mögliche diagnostische Maßnahmen</span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>
                  Strukturierte Darstellung der Anforderungen und
                  Fragestellungen
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>Einfache Anpassung nach individuellen Bedürfnissen</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-1">
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center">
              <FileText className="mr-3 size-8 text-primary" />
              <h3 className="font-bold text-2xl">Entlassungsberichte</h3>
            </div>
            <p className="mb-4">
              Basierend auf deinen Diagnosen und der Anamnese generiert die KI
              einen vollständigen Entlassungsbericht, den du nur noch anpassen
              musst.
            </p>
            <ul className="mb-6 space-y-2">
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>
                  Strukturierte Entlassungsberichte nach gängigen Standards
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>Automatische Einbindung relevanter Diagnosen</span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary" />
                <span>Individuelle Anpassungsmöglichkeiten</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center">
          <div className="mb-4 flex items-center gap-3">
            <Stethoscope className="size-8 text-primary" />
            <h3 className="font-bold text-2xl">
              Intuitiver Arbeitsablauf in drei einfachen Schritten
            </h3>
          </div>
          <div className="mt-6 grid w-full gap-4 md:grid-cols-3">
            <div className="relative rounded-lg border bg-card p-6 shadow-sm">
              <div className="-top-4 -left-4 absolute flex size-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                1
              </div>
              <h4 className="mb-2 font-semibold">Anamnese eingeben</h4>
              <p>
                Gib die Anamnese und Vordiagnosen ein oder nutze einen
                vorhandenen Textbaustein als Grundlage.
              </p>
            </div>
            <div className="relative rounded-lg border bg-card p-6 shadow-sm">
              <div className="-top-4 -left-4 absolute flex size-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                2
              </div>
              <h4 className="mb-2 font-semibold">KI-Vorschläge erhalten</h4>
              <p>
                Die KI strukturiert deine Eingabe und generiert passende
                Vorschläge für deinen Arztbrief.
              </p>
            </div>
            <div className="relative rounded-lg border bg-card p-6 shadow-sm">
              <div className="-top-4 -left-4 absolute flex size-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                3
              </div>
              <h4 className="mb-2 font-semibold">Bericht finalisieren</h4>
              <p>
                Überprüfe und passe den generierten Entlassungsbericht an deine
                speziellen Anforderungen an.
              </p>
            </div>
          </div>
          <Button className="mt-8" size="lg" asChild>
            <Link href="/aiscribe">KI-Funktionen ausprobieren</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
