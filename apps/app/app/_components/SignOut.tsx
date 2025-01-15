'use client';
import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';

export function SignOut() {
  return (
    <Link href={'/sign-in'}>
      <Button variant={'secondary'}>Sign Out</Button>
    </Link>
  );
}
