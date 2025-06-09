'use client';

import { authClient } from '@/lib/auth-client';
import {
  Alert,
  AlertDescription,
} from '@repo/design-system/components/ui/alert';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AIScribeLandingPage() {
  const { data: session, isPending } = authClient.useSession();
  const isLoggedIn = !!session?.user;

  return (
    <div className="container mx-auto flex h-full flex-col items-center justify-center p-4">
      <h1 className="mb-8 text-center font-bold text-3xl tracking-tight sm:text-4xl">
        Wählen Sie einen AI Scribe Modus
      </h1>
      {!isPending && !isLoggedIn && (
        <Alert variant="destructive" className="mb-6 max-w-5xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span>
              Du musst dich{' '}
              <Link href="/sign-in" className="underline hover:text-primary">
                einloggen
              </Link>{' '}
              um diese Funktion nutzen zu können
            </span>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link
          href={isLoggedIn ? '/aiscribe/er' : '#'}
          className={`block rounded-lg transition-shadow duration-200 ${
            isLoggedIn ? 'hover:shadow-lg' : 'cursor-not-allowed opacity-50'
          }`}
          onClick={(e) => !isLoggedIn && e.preventDefault()}
        >
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>ER Modus</CardTitle>
              <CardDescription>
                AI Scribe für Notaufnahme-Szenarien. Generieren Sie Anamnesen,
                Differenzialdiagnosen und Dispositionen.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link
          href={isLoggedIn ? '/aiscribe/icu' : '#'}
          className={`block rounded-lg transition-shadow duration-200 ${
            isLoggedIn ? 'hover:shadow-lg' : 'cursor-not-allowed opacity-50'
          }`}
          onClick={(e) => !isLoggedIn && e.preventDefault()}
        >
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>ICU Modus</CardTitle>
              <CardDescription>
                AI Scribe für Intensivstation-Szenarien. Generieren Sie
                Anamnesen, Differenzialdiagnosen und Dispositionen.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link
          href={isLoggedIn ? '/aiscribe/procedures' : '#'}
          className={`block rounded-lg transition-shadow duration-200 ${
            isLoggedIn ? 'hover:shadow-lg' : 'cursor-not-allowed opacity-50'
          }`}
          onClick={(e) => !isLoggedIn && e.preventDefault()}
        >
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Prozeduren Modus</CardTitle>
              <CardDescription>
                AI Scribe für Prozeduren. Geben Sie Notizen ein und generieren
                Sie Dokumentation für medizinische Eingriffe.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link
          href={isLoggedIn ? '/aiscribe/discharge' : '#'}
          className={`block rounded-lg transition-shadow duration-200 ${
            isLoggedIn ? 'hover:shadow-lg' : 'cursor-not-allowed opacity-50'
          }`}
          onClick={(e) => !isLoggedIn && e.preventDefault()}
        >
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Entlassung Modus</CardTitle>
              <CardDescription>
                AI Scribe für Entlassungsbriefe. Geben Sie Notizen ein und
                generieren Sie strukturierte Entlassungsdokumentation.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
