import { useSession } from '@/lib/auth-client';
import { Button } from '@repo/design-system/components/ui/button';
import { Brain, FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function AIFeatures() {
  const { data: session } = useSession();

  const isLoggedIn = !!session;
  const buttonLink = isLoggedIn ? '/aiscribe' : '/sign-in';
  const buttonText = isLoggedIn
    ? 'KI-Funktionen ausprobieren'
    : 'Registrieren & ausprobieren';

  return (
    <section className="py-12">
      <div className="container mx-auto max-w-5xl overflow-x-hidden">

        <div className="mb-4 w-full">
          <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
        </div>
        <p className="mb-8 text-center text-lg sm:text-xl">
          Mit unseren KI-Funktionen erstellst du Arztbriefe schneller und
          präziser
        </p>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col rounded-lg border bg-card p-4 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center">
              <Brain className="mr-3 size-6 sm:size-8 text-primary" />
              <h3 className="font-bold text-xl sm:text-2xl">Anamnese</h3>
            </div>
            <p className="mb-4 text-sm sm:text-base">
              Gib deine Notizen ein und unsere KI strukturiert automatisch eine
              vollständige Anamnese für deinen Arztbrief.
            </p>
            <ul className="mb-6 space-y-2 text-sm sm:text-base">
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>
                  Automatische Strukturierung nach medizinischen Standards
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>
                  Übersichtliche Gliederung der Patienteninformationen
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>Zeitersparnis bei der Dokumentation</span>
              </li>
            </ul>
          </div>


          <div className="relative flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="absolute top-2 right-[-28px] z-10 rotate-45 transform whitespace-nowrap bg-yellow-400 px-3 py-0.5 text-center font-semibold text-black text-xs shadow-md">
              Bald verfügbar
            </div>
            <div className="mb-4 flex items-center">
              <FileText className="mr-3 size-6 sm:size-8 text-primary" />
              <h3 className="font-bold text-xl sm:text-2xl">
                Anforderungen für Untersuchungen
              </h3>
            </div>
            <p className="mb-4 text-sm sm:text-base">
              Basierend auf der Anamnese generiert die KI passende
              Untersuchungsanforderungen und Fragestellungen für den weiteren
              Behandlungsverlauf.
            </p>
            <ul className="mb-6 space-y-2 text-sm sm:text-base">
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>Vorlagen für mögliche diagnostische Maßnahmen</span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>
                  Strukturierte Darstellung der Anforderungen und
                  Fragestellungen
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>Einfache Anpassung nach individuellen Bedürfnissen</span>
              </li>
            </ul>
          </div>

          <div className="relative flex flex-col rounded-lg border bg-card p-6 shadow-sm md:col-span-2">
            <div className="absolute top-2 right-[-28px] z-10 rotate-45 transform whitespace-nowrap bg-yellow-400 px-3 py-0.5 text-center font-semibold text-black text-xs shadow-md">
              Bald verfügbar
            </div>

            <div className="mb-4 flex items-center">
              <FileText className="mr-3 size-6 sm:size-8 text-primary" />
              <h3 className="font-bold text-xl sm:text-2xl">Entlassungsberichte</h3>
            </div>
            <p className="mb-4 text-sm sm:text-base">
              Basierend auf deinen Diagnosen und der Anamnese generiert die KI
              einen vollständigen Entlassungsbericht, den du nur noch anpassen
              musst.
            </p>
            <ul className="mb-6 space-y-2 text-sm sm:text-base">
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>
                  Strukturierte Entlassungsberichte nach gängigen Standards
                </span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>Automatische Einbindung relevanter Diagnosen</span>
              </li>
              <li className="flex items-start">
                <Sparkles className="mt-1 mr-2 size-4 text-primary flex-shrink-0" />
                <span>Individuelle Anpassungsmöglichkeiten</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center">
          <Button size="lg" asChild>
            <Link href={buttonLink}>{buttonText}</Link>
          </Button>
          {!isLoggedIn && (
            <p className="mt-4 text-center text-muted-foreground text-sm">
              Hinweis: Für die Nutzung der KI-Funktionen ist ein Konto
              erforderlich.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
