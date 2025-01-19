'use client';
import { authClient } from '@repo/auth/lib/auth-client';
import { Button } from '@repo/design-system/components/ui/button';
import { useRouter } from 'next/navigation';

export function SignOut() {
  const router = useRouter();
  return (
    <Button
      variant={'secondary'}
      onClick={async () => {
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push('/');
            },
          },
        });
      }}
    >
      Sign Out
    </Button>
  );
}
