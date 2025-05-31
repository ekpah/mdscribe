'use client';

import { signIn } from '@/lib/auth-client';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Checkbox } from '@repo/design-system/components/ui/checkbox';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  return (
    <Card className="w-full max-w-md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await signIn.email(
              { email, password, rememberMe, callbackURL: '/dashboard' },
              {
                onRequest: () => {
                  //show loading
                  setLoading(true);
                },
                onSuccess: () => {
                  //redirect to dashboard
                  router.refresh();
                  router.push('/templates');
                  setLoading(false);
                },
                onError: (ctx) => {
                  // Handle the error 403 - not email verified
                  if (ctx.error.status === 403) {
                    toast.error('Bitte bestätigen Sie Ihre E-Mail-Adresse');
                  } else {
                    toast.error(ctx.error.message);
                  }
                  setLoading(false);
                },
              }
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <CardHeader className="space-y-1">
          <CardTitle className="text-center font-bold text-2xl">
            In Ihren Account einloggen
          </CardTitle>
          <CardDescription className="text-center">
            Geben Sie unten Ihre E-Mail und Ihr Passwort ein, um sich anzumelden
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => setRememberMe(!rememberMe)}
              checked={rememberMe}
            />
            <Label htmlFor="remember">Angemeldet bleiben</Label>
          </div>

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Anmelden'
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground text-sm">
            <span className="mr-1">Noch kein Konto?</span>
            <Link href="/sign-up" className="text-primary hover:underline">
              Registrieren
            </Link>
          </div>
          <Link
            href="/forgot-password"
            className="text-primary text-sm hover:underline"
          >
            Passwort vergessen?
          </Link>
          <p className="text-muted-foreground text-xs">
            Mit der Registrierung akzeptieren Sie unsere{' '}
            <Link
              href="/legal?tab=datenschutz"
              className="text-primary hover:underline"
            >
              Datenschutzerklärung
            </Link>{' '}
            und unsere{' '}
            <Link
              href="/legal?tab=agb"
              className="text-primary hover:underline"
            >
              Geschäftsbedingungen
            </Link>
            .
          </p>
          <p className="mt-4 w-full text-center text-muted-foreground text-xs">
            Die Informationen auf dieser Website dienen ausschließlich zu
            Bildungszwecken und Vereinfachung der Dokumentation, stellen jedoch
            keine medizinische Beratung dar. Sie ersetzen nicht die Konsultation
            eines Arztes / einer Ärztin.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
