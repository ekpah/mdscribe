'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { authClient } from '@/lib/auth-client';
import DarkLogo from '@/public/logo/dark';
import LightLogo from '@/public/logo/light';
import { ModeToggle } from '@repo/design-system/components/mode-toggle';
import { Button } from '@repo/design-system/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@repo/design-system/components/ui/navigation-menu';
import { cn } from '@repo/design-system/lib/utils';

export default function TopMenuBar({ showAiLink }: { showAiLink: boolean }) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
        key="Menubar"
        className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4"
      >
        <div className="flex items-center">
          <Link href="/" className="mr-4">
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
                <NavigationMenuTrigger>Funktionen</NavigationMenuTrigger>
                <NavigationMenuContent data-orientation="vertical">
                  <ul className="grid md:w-[400px] lg:w-[500px]">
                    <ListItem href="/templates" title="Textbausteine">
                      Verwalten und nutzen Sie Ihre Textbausteine effizient.
                    </ListItem>
                    {showAiLink && (
                      <ListItem href="/aiscribe" title="AI Scribe">
                        Nutzen Sie KI um Ihre Texte zu optimieren und zu
                        erweitern.
                      </ListItem>
                    )}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>

                  <NavigationMenuLink href="https://docs.mdscribe.de/" className={navigationMenuTriggerStyle()}>
                    Erklärung
                  </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
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
            <Link href="/dashboard" className="mr-2 text-sm">
              {session.user.email}
            </Link>
          )}
          {session?.user ? (
            <Button
              variant="secondary"
              onClick={handleSignOut}
              className="mr-2"
            >
              Ausloggen
            </Button>
          ) : (
            <Link href="/sign-in" className="mr-2">
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
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Funktionen</NavigationMenuTrigger>
                <NavigationMenuContent data-orientation="vertical">
                  <ul className="grid md:w-[400px] lg:w-[500px]">
                    <ListItem href="/templates" title="Textbausteine">
                      Verwalten und nutzen Sie Ihre Textbausteine effizient.
                    </ListItem>
                    {showAiLink && (
                      <ListItem href="/aiscribe" title="AI Scribe">
                        Nutzen Sie KI um Ihre Texte zu optimieren und zu
                        erweitern.
                      </ListItem>
                    )}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                  <NavigationMenuLink  href="https://docs.mdscribe.de/" className={navigationMenuTriggerStyle()}>
                    Anleitung
                  </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <div className="mt-2 border-t pt-3">
            {session?.user && (
              <Link
                href="/dashboard"
                className="px-2 py-1 text-muted-foreground text-sm"
              >
                {session.user.email}
              </Link>
            )}

            <div className="flex items-center justify-between pt-2">
              {session?.user ? (
                <Button
                  variant="secondary"
                  onClick={handleSignOut}
                  className="w-full"
                >
                  Ausloggen
                </Button>
              ) : (
                <Link
                  href="/sign-in"
                  className="w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button className="w-full">Anmelden</Button>
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
const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className
          )}
          {...props}
        >
          <div className="font-medium text-sm leading-none">{title}</div>
          <p className="line-clamp-2 text-muted-foreground text-sm leading-snug">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
