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
import { AlertCircle, UserPlus } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/auth';

export default async function AIScribeLandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isLoggedIn = !!session?.user;

  return (
    <div className="container mx-auto flex h-full flex-col items-center justify-center p-4">
      <h1 className="mb-8 text-center font-bold text-3xl tracking-tight sm:text-4xl">
        Wählen Sie einen AI Scribe Modus
      </h1>

      {!isLoggedIn && (
        <>
          {/* Signup Banner */}
          <Alert className="mb-4 max-w-5xl" variant="default">
            <UserPlus className="h-4 w-4" />
            <AlertDescription>
              <span>
                Neu hier?{' '}
                <Link className="underline hover:text-primary" href="/sign-up">
                  Registriere dich kostenlos
                </Link>{' '}
                um Zugang zu allen AI Scribe Funktionen zu erhalten!
              </span>
            </AlertDescription>
          </Alert>

          {/* Login Required Banner */}
          <Alert className="mb-6 max-w-5xl" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span>
                Du musst dich{' '}
                <Link className="underline hover:text-primary" href="/sign-in?redirect=%2Faiscribe">
                  einloggen
                </Link>{' '}
                um diese Funktion nutzen zu können
              </span>
            </AlertDescription>
          </Alert>
        </>
      )}

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoggedIn ? (
          <Link
            className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
            href="/aiscribe/er"
          >
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>ER Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Notaufnahme-Szenarien. Generiere Anamnesen,
                  Differenzialdiagnosen und Dispositionen.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="block cursor-not-allowed rounded-lg opacity-50">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>ER Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Notaufnahme-Szenarien. Generiere Anamnesen,
                  Differenzialdiagnosen und Dispositionen.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {isLoggedIn ? (
          <Link
            className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
            href="/aiscribe/icu"
          >
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>ICU Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Intensivstation-Szenarien. Generiere Anamnesen,
                  Anamnesen, Differenzialdiagnosen und Dispositionen.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="block cursor-not-allowed rounded-lg opacity-50">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>ICU Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Intensivstation-Szenarien. Generiere Anamnesen,
                  Anamnesen, Differenzialdiagnosen und Dispositionen.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {isLoggedIn ? (
          <Link
            className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
            href="/aiscribe/outpatient"
          >
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Ambulanter Modus</CardTitle>
                <CardDescription>
                  AI Scribe für ambulante Konsultationen. Generiere
                  professionelle Arztbriefe für Ihre ambulanten Patienten.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="block cursor-not-allowed rounded-lg opacity-50">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Ambulanter Modus</CardTitle>
                <CardDescription>
                  AI Scribe für ambulante Konsultationen. Generiere
                  professionelle Arztbriefe für Ihre ambulanten Patienten.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {isLoggedIn ? (
          <Link
            className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
            href="/aiscribe/procedures"
          >
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Prozeduren Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Prozeduren. Geben Sie Notizen ein und generiere
                  Dokumentation für medizinische Eingriffe.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="block cursor-not-allowed rounded-lg opacity-50">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Prozeduren Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Prozeduren. Geben Sie Notizen ein und generiere
                  Dokumentation für medizinische Eingriffe.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {isLoggedIn ? (
          <Link
            className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
            href="/aiscribe/discharge"
          >
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Entlassung Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Entlassungsbriefe. Geben Sie Notizen ein und
                  generiere strukturierte Entlassungsdokumentation.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <div className="block cursor-not-allowed rounded-lg opacity-50">
            <Card className="flex h-full flex-col">
              <CardHeader>
                <CardTitle>Entlassung Modus</CardTitle>
                <CardDescription>
                  AI Scribe für Entlassungsbriefe. Geben Sie Notizen ein und
                  generiere strukturierte Entlassungsdokumentation.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
