import { Button } from '@repo/design-system/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/lib/auth-client';

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
  const signInUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;

  return (
    <section className="bg-muted/30 py-12 sm:py-16">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h1 className="my-2 w-full font-bold text-4xl leading-tight sm:text-5xl">
            Starte kostenlos
          </h1>
          <div className="mb-4 w-full">
            <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
          </div>
          <p className="mb-12 text-lg text-muted-foreground sm:text-xl">
            Beginne sofort mit unserem kostenlosen Basis-Plan und erweitere bei
            Bedarf
          </p>
        </div>

        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center rounded-full border p-1">
            <button
              className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${isYearly
                ? 'bg-transparent hover:bg-muted'
                : 'bg-primary text-primary-foreground'
                }`}
              onClick={() => setIsYearly(false)}
              type="button"
            >
              Monatlich
            </button>
            <button
              className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${isYearly
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent hover:bg-muted'
                }`}
              onClick={() => setIsYearly(true)}
              type="button"
            >
              Jährlich <span className="text-xs opacity-75">(-17%)</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Basic Plan */}
          <div className="flex flex-col rounded-lg border-2 border-solarized-green/50 bg-card p-6 shadow-lg">
            <div className="mb-4">
              <div className="mb-2 flex items-center">
                <h3 className="font-bold text-2xl">Basis</h3>
                <span className="ml-2 rounded-full bg-solarized-green/10 px-2 py-1 font-medium text-solarized-green text-xs">
                  Empfohlen
                </span>
              </div>
              <p className="mt-2 text-muted-foreground">
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
                <span>Basis Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>Grundfunktionen</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>Community Support</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-solarized-green" />
                <span>Textbaustein-Editor</span>
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
            <div className="mb-4">
              <h3 className="font-bold text-2xl">Plus</h3>
              <p className="mt-2 text-muted-foreground">Für aktive Nutzer</p>
            </div>
            <div className="mb-4 min-h-[5rem]">
              <div>
                <span className="font-bold text-4xl">
                  €{isYearly ? '7,50' : '9'}
                </span>
                <span className="text-muted-foreground">/Monat</span>
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                {isYearly ? 'Jährlich abgerechnet' : 'Monatlich kündbar'}
              </p>
            </div>
            <ul className="mb-6 space-y-3">
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span className="font-medium">Alle Basis-Features</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Alle Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>500 Generierungen/Monat</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Erweiterte Funktionen</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>E-Mail Support</span>
              </li>
            </ul>
            <Button asChild className="mt-auto" variant="outline">
              <Link href={session?.user ? '/dashboard' : signInUrl}>
                Upgrade zu Plus
              </Link>
            </Button>
          </div>

          {/* Enterprise Plan */}
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-bold text-2xl">Enterprise</h3>
              <p className="mt-2 text-muted-foreground">
                Für Krankenhäuser und Praxen
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
                <span className="font-medium">Alle Plus-Features</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Geteilte Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Unbegrenzte Nutzung</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>Premium Features</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>24/7 Premium Support</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-3 h-5 w-5 text-primary" />
                <span>On-Premise Hosting</span>
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
            Starte kostenlos und upgrade nur wenn du mehr brauchst.
          </p>
          <Button asChild className="px-8 py-6 font-semibold text-lg" size="lg">
            <Link href="/sign-up">Jetzt kostenlos registrieren</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
