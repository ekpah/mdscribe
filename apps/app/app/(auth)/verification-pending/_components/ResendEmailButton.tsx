'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { authClient } from '@/lib/auth-client';

export function ResendEmailButton() {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [lastSentTime, setLastSentTime] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const { data: session } = authClient.useSession();

  // Countdown timer for rate limiting
  useEffect(() => {
    if (!lastSentTime) {
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastSentTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      setRemainingSeconds(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [lastSentTime]);

  const handleResendEmail = async () => {
    if (!session?.user?.email) {
      toast.error('E-Mail-Adresse nicht gefunden. Bitte melde dich erneut an.');
      return;
    }

    // Check rate limit
    if (remainingSeconds > 0) {
      toast.error(`Bitte warte noch ${remainingSeconds} Sekunden.`);
      return;
    }

    setResending(true);
    try {
      await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: '/email-verified',
      });

      setLastSentTime(Date.now());
      setResent(true);
      toast.success('Verifizierungs-E-Mail wurde erneut gesendet!');

      // Reset "resent" state after 3 seconds
      setTimeout(() => setResent(false), 3000);
    } catch (error) {
      toast.error(
        'Fehler beim Senden der E-Mail. Bitte versuche es später erneut.'
      );
      console.error('Resend error:', error);
    } finally {
      setResending(false);
    }
  };

  const getButtonContent = () => {
    if (resending) {
      return (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Wird gesendet...
        </>
      );
    }

    if (remainingSeconds > 0) {
      return (
        <>
          <RefreshCw className="mr-2 h-5 w-5" />
          Erneut senden in {remainingSeconds}s
        </>
      );
    }

    if (resent) {
      return (
        <>
          <CheckCircle2 className="mr-2 h-5 w-5" />
          E-Mail gesendet
        </>
      );
    }

    return (
      <>
        <RefreshCw className="mr-2 h-5 w-5" />
        E-Mail erneut senden
      </>
    );
  };

  return (
    <Button
      className="w-full px-6 py-4 text-base sm:w-auto sm:px-8 sm:py-6 sm:text-lg"
      disabled={resending || remainingSeconds > 0}
      onClick={handleResendEmail}
      size="lg"
      type="button"
      variant="default"
    >
      {getButtonContent()}
    </Button>
  );
}

