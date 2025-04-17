import { Button } from '@repo/design-system/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="bg-muted/30 py-12">
      <div className="container mx-auto max-w-5xl">
        <h1 className="my-2 w-full text-center font-bold text-5xl leading-tight">
          Preise
        </h1>
        <div className="mb-4 w-full">
          <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
        </div>
        <p className="mb-8 text-center text-xl">
          Wähle den Plan, der zu deinen Bedürfnissen passt
        </p>

        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center rounded-full border p-1">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${
                isYearly
                  ? 'bg-transparent hover:bg-muted'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              Monatlich
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${
                isYearly
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent hover:bg-muted'
              }`}
            >
              Jährlich <span className="text-xs opacity-75">(-17%)</span>
            </button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Free Plan */}
          <div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="font-bold text-2xl">Kostenlos</h3>
              <p className="mt-2 text-muted-foreground">
                Für gelegentliche Nutzer
              </p>
            </div>
            <div className="mb-4 min-h-[5rem]">
              <div>
                <span className="font-bold text-4xl">€0</span>
                <span className="text-muted-foreground">/Monat</span>
              </div>
              <p className="mt-1 h-4 text-muted-foreground text-xs">&nbsp;</p>
            </div>
            <ul className="mb-6 space-y-2">
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Basis Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>10 Anamnesen pro Monat</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Community Support</span>
              </li>
            </ul>
            <Button className="mt-auto" variant="outline" asChild>
              <Link href="/auth/signup">Starten</Link>
            </Button>
          </div>

          {/* Plus Plan */}
          <div className="relative flex flex-col rounded-lg border bg-card p-6 shadow-sm">
            <div className="-top-4 absolute right-0 rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground text-sm">
              Beliebt
            </div>
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
              <p className="mt-1 h-4 text-muted-foreground text-xs">
                {isYearly ? 'Jährliche Abrechnung: €90/Jahr' : '\u00A0'}
              </p>
            </div>
            <ul className="mb-6 space-y-2">
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Alle Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>500 Anamnesen pro Monat</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>AI-Unterstützung</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>E-Mail Support</span>
              </li>
            </ul>
            <Button className="mt-auto">
              <Link
                href={`/auth/signup?plan=plus&billing=${isYearly ? 'yearly' : 'monthly'}`}
              >
                Jetzt starten
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
              <div>
                <span className="rounded bg-muted px-2 py-1 font-medium text-lg">
                  Bald verfügbar
                </span>
              </div>
              <p className="mt-1 h-4 text-muted-foreground text-xs">&nbsp;</p>
            </div>
            <ul className="mb-6 space-y-2">
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Geteilte Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Dokumenten- und SOP-Management</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Erweiterte AI-Funktionen</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>Eigene Textbausteine</span>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 size-4 text-primary" />
                <span>24/7 Premium Support</span>
              </li>
            </ul>
            <Button className="mt-auto">
              <Link href="/contact?subject=Enterprise-Interesse">
                Interesse anmelden
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
