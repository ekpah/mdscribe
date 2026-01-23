'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Brain, FileText, Sparkles, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Doctors from '@/public/landing/Doctors';

interface HeroProps {
  isLoggedIn: boolean;
}

// PERF: Accept isLoggedIn from server instead of using useSession()
export default function Hero({ isLoggedIn }: HeroProps) {
  const pathname = usePathname();
  const signInUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;

  return (
    <div className="relative flex min-h-[90vh] flex-col items-center overflow-hidden bg-gradient-to-b from-background to-muted/30 px-4 py-8 md:flex-row md:px-6">
      {/* Left Column */}
      <div className="flex w-full flex-col items-center justify-center text-center md:w-2/5 md:items-start md:py-12 md:text-left">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-solarized-blue/10 px-3 py-1.5 font-medium text-sm text-solarized-blue md:px-4 md:py-2">
          <Brain className="h-4 w-4" />
          <span>KI-gestützte Dokumentation</span>
        </div>

        {/* Main Headline */}
        <h1 className="my-6 max-w-2xl font-bold text-3xl leading-tight md:my-8 md:text-4xl lg:text-5xl xl:text-6xl">
          Arztbriefe mit{' '}
          <span className="bg-gradient-to-r from-solarized-blue to-solarized-green bg-clip-text text-transparent">
            KI-Unterstützung
          </span>{' '}
          erstellen
        </h1>

        {/* Subtitle */}
        <p className='mb-8 max-w-xl text-lg text-muted-foreground leading-relaxed md:mb-10 md:text-xl lg:text-2xl'>
          Von Notizen zu professionellen Arztbriefen in Sekunden. Nutze die
          Kraft der KI für schnellere und präzisere medizinische Dokumentation.
        </p>

        {/* CTA Buttons */}
        <div className="flex w-full max-w-md flex-col gap-3 sm:max-w-lg sm:flex-row sm:gap-4">
          {/* Primary CTA */}
          <Button
            asChild
            className="group w-full flex-1 px-6 py-4 font-semibold text-base shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl sm:px-8 sm:py-6 sm:text-lg"
            id="primary-cta"
            size="lg"
          >
            <Link
              className="flex items-center justify-center gap-2"
              href={isLoggedIn ? '/aiscribe' : signInUrl}
            >
              {isLoggedIn ? (
                <>
                  <Brain className="h-5 w-5 transition-transform group-hover:scale-110" />
                  <span>KI-Assistenz starten</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 transition-transform group-hover:scale-110" />
                  <span>Jetzt anmelden</span>
                </>
              )}
            </Link>
          </Button>

          {/* Secondary CTA */}
          <Button
            asChild
            className="w-full flex-1 px-6 py-4 font-semibold text-base sm:px-8 sm:py-6 sm:text-lg"
            size="lg"
            variant="outline"
          >
            <Link
              className="flex items-center justify-center gap-2"
              href="/templates"
            >
              <FileText className="h-5 w-5" />
              <span>Textbausteine</span>
            </Link>
          </Button>
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 grid grid-cols-1 gap-4 text-center sm:grid-cols-3 sm:text-left md:mt-10">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-solarized-green/10">
              <Sparkles className="h-4 w-4 text-solarized-green" />
            </div>
            <span className='font-medium text-foreground text-sm'>
              In Sekunden fertig
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-solarized-blue/10">
              <Brain className="h-4 w-4 text-solarized-blue" />
            </div>
            <span className='font-medium text-foreground text-sm'>
              KI-optimiert
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-solarized-orange/10">
              <FileText className="h-4 w-4 text-solarized-orange" />
            </div>
            <span className='font-medium text-foreground text-sm'>
              Professionell
            </span>
          </div>
        </div>

      </div>

      {/* Right Column */}
      <div className="mt-8 w-full text-center md:mt-0 md:w-3/5">
        <div className="mx-auto max-w-2xl">
          <Doctors />
        </div>
      </div>
    </div>
  );
}
