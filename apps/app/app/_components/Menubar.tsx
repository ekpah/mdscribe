'use client';
import Logo from '@/public/Logo';

import Link from 'next/link';

import { authClient } from '@repo/auth/lib/auth-client';
import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import { SignIn } from './SignIn';
import { SignOut } from './SignOut';

export default function TopMenuBar() {
  const {
    data: session,
    isPending, //loading state
    error, //error object
  } = authClient.useSession();

  return (
    <div
      key="Menubar"
      className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div key="menuBarLinks" className="pl-10 font-light">
          <Link href="/templates/">Textbausteine</Link>
          {/* TODO: link as env to make it work in development */}
          <Link className="ml-4" href="https://docs.mdscribe.de/">
            Dokumentation
          </Link>
        </div>

        <div className="absolute right-2 flex flex-row sm:right-4">
          <div className="mx-4 flex flex-row items-center">
            <p className="mx-4">{session?.user?.email}</p>
            {session?.user ? <SignOut /> : <SignIn />}
          </div>
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
