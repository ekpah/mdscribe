'use client';

import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import { Button } from '@repo/design-system/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@repo/design-system/components/ui/navigation-menu';
import { cn } from '@repo/design-system/lib/utils';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import DarkLogo from '@/public/logo/dark';
import LightLogo from '@/public/logo/light';

export default function TopMenuBar({
  showAiLink,
}: {
  showAiLink: boolean;
}) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: session } = authClient.useSession()

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

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="relative">
      <div
        className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4"
        key="Menubar"
      >
        <div className="flex items-center">
          <Link className="mr-4" href="/">
            <div className="dark:hidden">
              <LightLogo />
            </div>
            <div className="hidden dark:block">
              <DarkLogo />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <NavigationMenu className="hidden md:block">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={navigationMenuTriggerStyle()}
                  href="/templates"
                >
                  Textbausteine
                </NavigationMenuLink>
              </NavigationMenuItem>
              {showAiLink && (
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    href="/aiscribe"
                  >
                    AI Scribe
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={navigationMenuTriggerStyle()}
                  href="https://docs.mdscribe.de/"
                >
                  Erklärung
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex md:hidden">
          <Button onClick={toggleMobileMenu} size="icon" variant="ghost">
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Desktop User Controls */}
        <div className="hidden items-center md:flex">
          {session?.user && (
            <Link className="mr-2 text-sm" href="/dashboard">
              {session.user.email}
            </Link>
          )}
          {session?.user ? (
            <Button
              className="mr-2"
              onClick={handleSignOut}
              variant="secondary"
            >
              Ausloggen
            </Button>
          ) : (
            <Link className="mr-2" href="/sign-in">
              <Button>Anmelden</Button>
            </Link>
          )}
          <ModeToggle />
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'absolute right-0 left-0 z-50 flex flex-col border-b bg-background shadow-lg md:hidden',
          mobileMenuOpen ? 'block' : 'hidden'
        )}
      >
        <div className="flex flex-col space-y-3 p-4">
          <NavigationMenu>
            <NavigationMenuList className="flex flex-col space-y-2">
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={navigationMenuTriggerStyle()}
                  href="/templates"
                >
                  Textbausteine
                </NavigationMenuLink>
              </NavigationMenuItem>
              {showAiLink && (
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    href="/aiscribe"
                  >
                    AI Scribe
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
              <NavigationMenuItem>
                <NavigationMenuLink
                  className={navigationMenuTriggerStyle()}
                  href="https://docs.mdscribe.de/"
                >
                  Anleitung
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <div className="mt-2 border-t pt-3">
            {session?.user && (
              <Link
                className="px-2 py-1 text-muted-foreground text-sm"
                href="/dashboard"
              >
                {session.user.email}
              </Link>
            )}

            <div className="flex items-center justify-between pt-2">
              {session?.user ? (
                <Button
                  className="w-full"
                  onClick={handleSignOut}
                  variant="secondary"
                >
                  Ausloggen
                </Button>
              ) : (
                <Link
                  className="w-full"
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button className="w-full">Jetzt anmelden</Button>
                </Link>
              )}
              <div className="ml-2">
                <ModeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}