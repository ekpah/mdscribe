'use client';

import { authClient } from '@/lib/auth-client';
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
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      toast.error('Ungültiger oder fehlender Token');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await authClient.resetPassword({
        newPassword,
        token,
      });

      if (error) {
        toast.error(error?.message || 'Ein Fehler ist aufgetreten');
        return;
      }

      toast.success('Passwort erfolgreich zurückgesetzt');
      router.push('/sign-in');
    } catch (err) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="z-50 max-w-md rounded-md rounded-t-none">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          Neues Passwort festlegen
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Bitte geben Sie Ihr neues Passwort ein
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-password">Neues Passwort</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Neues Passwort"
              required
              onChange={(e) => {
                setNewPassword(e.target.value);
              }}
              value={newPassword}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            onClick={handleResetPassword}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Passwort zurücksetzen'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
