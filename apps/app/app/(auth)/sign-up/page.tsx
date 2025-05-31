'use client';

import { signUp } from '@/lib/auth-client';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function SignUp() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Card className="z-50 max-w-md rounded-md rounded-t-none">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Registrieren</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Geben Sie Ihre Informationen ein, um ein Konto zu erstellen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@beispiel.de"
              required
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Passwort"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Passwort bestätigen</Label>
            <Input
              id="password_confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              autoComplete="new-password"
              placeholder="Passwort bestätigen"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              await signUp.email({
                email,
                password,
                name: `${firstName} ${lastName}`,
                callbackURL: '/',
                fetchOptions: {
                  onResponse: () => {
                    setLoading(false);
                  },
                  onRequest: () => {
                    setLoading(true);
                  },
                  onError: (ctx) => {
                    toast.error(ctx.error.message);
                  },
                  onSuccess: async () => {
                    toast.success(
                      'Konto erstellt! Bitte bestätige deine E-Mail.'
                    );
                    router.push('/');
                  },
                },
              });
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Konto erstellen'
            )}
          </Button>
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
        </div>
      </CardContent>
    </Card>
  );
}
