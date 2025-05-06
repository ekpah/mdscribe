import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import Link from 'next/link';

export default function AIScribeLandingPage() {
  return (
    <div className="container mx-auto flex h-full flex-col items-center justify-center p-4">
      <h1 className="mb-8 text-center font-bold text-3xl tracking-tight sm:text-4xl">
        Wählen Sie einen AI Scribe Modus
      </h1>
      <div className="grid w-full max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/aiscribe/er"
          className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
        >
          <Card className="flex h-full flex-col">
            {' '}
            {/* Ensure cards have equal height if content differs */}
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
          href="/aiscribe/icu"
          className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
        >
          <Card className="flex h-full flex-col">
            {' '}
            {/* Ensure cards have equal height if content differs */}
            <CardHeader>
              <CardTitle>ICU Modus</CardTitle>
              <CardDescription>
                AI Scribe für Intensivstation-Szenarien. Generieren Sie
                Anamnesen, Differenzialdiagnosen und Dispositionen.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
