'use client';
import DarkLogo from '@/public/logo/dark';
import LightLogo from '@/public/logo/light';

import Link from 'next/link';

import { authClient } from '@repo/auth/lib/auth-client';
import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import { Button } from '@repo/design-system/components/ui/button';
import { useRouter } from 'next/navigation';

export default function TopMenuBar({ showAiLink }: { showAiLink: boolean }) {
  const {
    data: session,
    isPending, //loading state
    error, //error object
  } = authClient.useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh();
          router.push('/');
        },
      },
    });
  };

  return (
    <div
      key="Menubar"
      className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <div className="dark:hidden">
              <LightLogo />
            </div>
            <div className="hidden dark:block">
              <DarkLogo />
            </div>
          </Link>
        </div>
        <div key="menuBarLinks" className="pl-10 font-light">
          <Link href="/templates/">Textbausteine</Link>
          {/* TODO: link as env to make it work in development */}
          <Link className="ml-4" href="https://docs.mdscribe.de/">
            Dokumentation
          </Link>
          {showAiLink && (
            <Link className="ml-4" href="/aiscribe">
              Anamnese
            </Link>
          )}
        </div>

        <div className="absolute right-2 hidden flex-row sm:right-4 sm:flex">
          <div className="mx-4 flex flex-row items-center">
            {session?.user && (
              <Link href={'/dashboard'} className="mx-4">
                {session?.user?.email}
              </Link>
            )}
            {session?.user ? (
              <Button variant={'secondary'} onClick={handleSignOut}>
                Ausloggen
              </Button>
            ) : (
              <Link href={'/sign-in'}>
                <Button>Anmelden</Button>
              </Link>
            )}
          </div>
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
