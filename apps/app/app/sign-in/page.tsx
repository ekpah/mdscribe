'use client';

import { signIn } from '@repo/auth/lib/auth-client';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Checkbox } from '@repo/design-system/components/ui/checkbox';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  return (
    <Card className="w-full max-w-md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await signIn.email(
              { email, password },
              {
                onRequest: () => {
                  //show loading
                  setLoading(true);
                },
                onSuccess: () => {
                  //redirect to dashboard
                  router.push('/templates');
                  setLoading(false);
                },
                onError: (ctx) => {
                  alert(ctx.error.message);
                  setLoading(false);
                },
              }
            );
          } finally {
            setLoading(false);
          }
        }}
      >
        <CardHeader className="space-y-1">
          <CardTitle className="text-center font-bold text-2xl">
            Sign in to your account
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email and password below to sign in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              onClick={() => setRememberMe(!rememberMe)}
            />
            <Label htmlFor="remember">Remember me</Label>
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Sign In'
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-muted-foreground text-sm">
            <span className="mr-1">Don&apos;t have an account?</span>
            <Link href="/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
          <Link
            href="/forgot-password"
            className="text-primary text-sm hover:underline"
          >
            Forgot password?
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
