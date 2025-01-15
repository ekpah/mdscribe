'use client';
import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';

export function SignIn() {
  return (
    <Link href={'/sign-in'}>
      <Button>Sign In</Button>
    </Link>
  );
}
