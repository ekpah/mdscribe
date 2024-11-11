'use client';
import { Button } from '@repo/design-system/components/ui/button';
import { signIn } from 'next-auth/react';

export function SignIn() {
  return <Button onClick={() => signIn()}>Sign In</Button>;
}
