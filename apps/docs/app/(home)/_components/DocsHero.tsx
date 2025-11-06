import { Alert, AlertDescription } from '@repo/design-system/components/ui/alert';
import { Button } from '@repo/design-system/components/ui/button';
import { ArrowRight, BookMarked, BookOpen, Code, Rocket, Zap } from 'lucide-react';
import Link from 'next/link';

// App URL - can be configured via environment variable
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function DocsHero() {
  return (
    <div className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4 py-16 md:py-24">

      {/* Content Container */}
      <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-solarized-cyan/20 bg-solarized-cyan/5 px-4 py-2 font-medium text-sm text-solarized-cyan backdrop-blur-sm">
          <BookOpen className="h-4 w-4" />
          <span>Dokumentation</span>
        </div>

        {/* Main Headline */}
        <h1 className="mb-6 font-bold text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl">
          Willkommen in der{' '}
          <span className="bg-gradient-to-r from-solarized-blue to-solarized-blue/50 bg-clip-text text-transparent">
            MDScribe Dokumentation
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground leading-relaxed md:text-xl">
          Lerne alles darüber, wie du MDScribe nutzt, um die medizinische
          Dokumentation möglichst einfach und gut zu machen. Von Templates bis
          KI-gestützter Generierung - alles an einem Ort.
        </p>

        {/* CTA Buttons */}
        <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            asChild
            className="group px-8 py-6 font-semibold text-base shadow-md transition-all duration-200 hover:shadow-lg"
            id="primary-cta"
            size="lg"
          >
            <Link
              className="flex items-center justify-center gap-2"
              href="/docs/quickstart"
            >
              <Zap className="h-5 w-5" />
              <span>Schnellstart</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>

          <Button
            asChild
            className="px-8 py-6 font-semibold text-base"
            size="lg"
            variant="outline"
          >
            <Link
              className="flex items-center justify-center gap-2"
              href="/docs/templates"
            >
              <BookMarked className="h-5 w-5" />
              <span>Templates</span>
            </Link>
          </Button>
        </div>

        {/* Quick Links Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            className="group rounded-lg border border-border bg-card p-6 text-left transition-all hover:border-solarized-cyan/50 hover:shadow-md"
            href="/docs/quickstart"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-solarized-cyan/10">
              <Zap className="h-5 w-5 text-solarized-cyan" />
            </div>
            <h3 className="mb-2 font-semibold text-base">Schnellstart</h3>
            <p className="text-muted-foreground text-sm">
              Erste Schritte mit MDScribe
            </p>
          </Link>

          <Link
            className="group rounded-lg border border-border bg-card p-6 text-left transition-all hover:border-solarized-violet/50 hover:shadow-md"
            href="/docs/templates"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-solarized-violet/10">
              <BookMarked className="h-5 w-5 text-solarized-violet" />
            </div>
            <h3 className="mb-2 font-semibold text-base">Templates</h3>
            <p className="text-muted-foreground text-sm">
              Erstelle und verwalte Templates
            </p>
          </Link>

          <Link
            className="group rounded-lg border border-border bg-card p-6 text-left transition-all hover:border-solarized-blue/50 hover:shadow-md"
            href="/docs/ai"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-solarized-blue/10">
              <Code className="h-5 w-5 text-solarized-blue" />
            </div>
            <h3 className="mb-2 font-semibold text-base">KI-Funktionen</h3>
            <p className="text-muted-foreground text-sm">
              Nutze KI für bessere Dokumentation
            </p>
          </Link>
        </div>

      </div>
    </div>
  );
}

