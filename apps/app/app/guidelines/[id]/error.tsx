'use client';

import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <h2 className="font-semibold text-2xl">Etwas ist schief gelaufen!</h2>
      <p className="text-muted-foreground">
        {error.message || 'Die Guideline konnte nicht geladen werden.'}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Erneut versuchen</Button>
        <Link href="/guidelines">
          <Button variant="outline">Zurück zur Übersicht</Button>
        </Link>
      </div>
    </div>
  );
}
