import { Button } from '@repo/design-system/components/ui/button';
import { Check, Shield } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@repo/design-system/components/ui/skeleton';

export default function PricingSkeleton() {
  return (
    <section className="bg-muted/30 py-12 sm:py-16">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h1 className="my-2 w-full font-bold text-4xl leading-tight sm:text-5xl">
            Starte kostenlos mit KI
          </h1>
          <div className="mb-4 w-full">
            <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
          </div>
          <p className="mb-12 text-lg text-muted-foreground sm:text-xl">
            Wähle das passende Lizenzmodell – vom Open-Source-Start bis zur
            Enterprise-Lösung.
          </p>
        </div>

        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center rounded-full border p-1">
            <button
              className="rounded-full px-4 py-2 font-medium text-sm transition-all bg-primary text-primary-foreground"
              disabled
              type="button"
            >
              Monatlich
            </button>
            <button
              className="rounded-full px-4 py-2 font-medium text-sm transition-all bg-transparent hover:bg-muted"
              disabled
              type="button"
            >
              Jährlich <span className="text-xs opacity-75">(-17%)</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {/* Free Plan */}
          <div className="flex flex-col rounded-lg border-2 border-solarized-green/50 bg-card p-6 shadow-lg">
            <div className="mb-4 min-h-[4.5rem]">
              <h3 className="mb-2 font-bold text-2xl">MDScribe Free</h3>
              <p className="text-muted-foreground">
                Perfekt für den Einstieg
              </p>
            </div>
            <div className="mb-4 min-h-[5rem]">
              <div>
                <span className="font-bold text-3xl text-solarized-green">
                  Kostenlos
                </span>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                Für immer kostenlos
              </p>
            </div>
            <ul className="mb-6 space-y-3">
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>50 KI-Requests/Monat</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>Eigene Templates erstellen</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>Basis-Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>Community Support</span>
              </li>
            </ul>
            <Button
              asChild
              className="mt-auto bg-solarized-green hover:bg-solarized-green/90"
            >
              <Link href="/sign-up">Kostenlos starten</Link>
            </Button>
          </div>

          {/* Plus Plan */}
          <div className="relative flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4 min-h-[4.5rem]">
              <h3 className="mb-2 font-bold text-2xl">MDScribe Plus</h3>
              <p className="text-muted-foreground">
                Für den klinischen Alltag
              </p>
            </div>
            <div className="mb-4 min-h-[5rem]">
              <div>
                <Skeleton className="inline-block h-10 w-16" />
                <span className="text-muted-foreground">/Monat</span>
              </div>
              <Skeleton className="mt-1 h-5 w-28" />
            </div>
            <ul className="mb-6 space-y-3">
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span className="font-medium">Alle kostenlosen Features</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Alle Templates & Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>500 KI-Requests/Monat</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Vollständige KI-Unterstützung</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Priorisierter E-Mail Support</span>
              </li>
            </ul>
            <Skeleton className="mt-auto h-11 w-full" />
          </div>

          {/* Team Plan */}
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4 min-h-[4.5rem]">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-bold text-2xl">MDScribe Team</h3>
                <span className="rounded-full bg-solarized-blue/10 px-2 py-1 font-medium text-solarized-blue text-xs">
                  Coming soon
                </span>
              </div>
              <p className="text-muted-foreground">
                Für Teams und Abteilungen
              </p>
            </div>
            <div className="mb-4 min-h-[5rem]">
              <div className="flex flex-col items-start">
                <span className="inline-flex items-center rounded-lg bg-muted/60 px-4 py-2 font-medium text-lg text-muted-foreground">
                  Demnächst verfügbar
                </span>
                <p className="mt-2 text-muted-foreground text-sm">
                  Team-Lizenzen mit eigenem Kontext
                </p>
              </div>
            </div>
            <ul className="mb-6 space-y-3">
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span className="font-medium">Team-Lizenzen</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Eigene API-Keys</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Gemeinsamer Team-Kontext</span>
              </li>
              <li className="flex items-center">
                <Shield className="mr-3 h-5 w-5 text-primary" />
                <span>Zero Data Retention für KI-Requests</span>
              </li>
            </ul>
            <Button className="mt-auto" disabled type="button" variant="outline">
              Coming soon
            </Button>
          </div>

          {/* Enterprise Plan */}
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4 min-h-[4.5rem]">
              <h3 className="mb-2 font-bold text-2xl">MDScribe Enterprise</h3>
              <p className="text-muted-foreground">
                Für Kliniken mit Enterprise-Anspruch
              </p>
            </div>
            <div className="mb-4 min-h-[5rem]">
              <div className="flex flex-col items-start">
                <span className="inline-flex items-center rounded-lg bg-muted/60 px-4 py-2 font-medium text-lg text-muted-foreground">
                  Auf Anfrage
                </span>
                <p className="mt-2 text-muted-foreground text-sm">
                  Individuelle Lösungen & Preise
                </p>
              </div>
            </div>
            <ul className="mb-6 space-y-3">
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span className="font-medium">Alle Team-Features</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Individuelle SLAs & Beratung</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Enterprise Security & Compliance</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>On-Premise / Self-Hosted</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Dedizierter Support</span>
              </li>
            </ul>
            <Button asChild className="mt-auto" variant="outline">
              <Link href="mailto:support@mdscribe.de?subject=MD-Scribe-Enterprise">
                Kontakt aufnehmen
              </Link>
            </Button>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <h3 className="mb-4 font-bold text-2xl">Bereit anzufangen?</h3>
          <p className="mb-6 text-lg text-muted-foreground">
            Starte kostenlos und upgrade nur, wenn du mehr brauchst.
          </p>
          <Button asChild className="px-8 py-6 font-semibold text-lg" size="lg">
            <Link href="/sign-up">Jetzt kostenlos registrieren</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

