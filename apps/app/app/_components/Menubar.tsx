import { auth } from '@/auth';

import Logo from '@/public/Logo';

import Link from 'next/link';

import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import { SignIn } from './SignIn';
import { SignOut } from './SignOut';

export default async function TopMenuBar() {
  const session = await auth();

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
          <Link href="/templates/cm27xjij0000atvlt77tdkvrl">Textbausteine</Link>
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
