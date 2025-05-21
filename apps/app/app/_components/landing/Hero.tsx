import Doctors from '@/public/landing/Doctors';
import { Badge } from '@repo/design-system/components/ui/badge';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { FileText, Search } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export default function Hero() {
  const [filterTerm, setFilterTerm] = useState('');
  const isMac =
    typeof window !== 'undefined' && window.navigator.userAgent.includes('Mac');
  useHotkeys(['meta+k', 'ctrl+k'], (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.value = '';
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const scrollToContent = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth',
    });
  };

  return (
    <div className="relative flex min-h-[90vh] flex-col flex-wrap items-center overflow-hidden bg-gradient-to-b from-background to-muted/30 px-3 md:flex-row">

      {/*<!--Left Col-->*/}
      <div className="flex w-full flex-col items-start justify-center px-3 py-6 text-center md:w-2/5 md:py-3 md:text-left">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-sm">
          Arztbriefe leicht gemacht
        </div>
        <h1 className="my-4 font-bold text-5xl leading-tight">
          Arztbriefe erstellen ohne sich zu wiederholen
        </h1>
        <p className="mb-8 text-2xl leading-normal">
          Nutze schlaue Textbausteine und KI-Unterstützung, um schneller und
          effizienter zu dokumentieren
        </p>
        <form
          className="relative flex w-full flex-col gap-2 sm:flex-row"
          action="/templates?filter="
        >
          <div className="relative flex-grow">
            <Label htmlFor="search" className="sr-only">
              Search
            </Label>
            <Input
              type="search"
              placeholder="Suchen..."
              className="rounded-md bg-muted pl-8 text-sm"
              value={filterTerm}
              name="filter"
              ref={searchInputRef}
              onChange={(e) => setFilterTerm(e.target.value)}
            />
            <Search className="-translate-y-1/2 pointer-events-none absolute top-[50%] left-2 size-4 select-none opacity-50" />
            <Badge
              variant="secondary"
              className="-translate-y-1/2 pointer-events-none absolute top-[50%] right-2 select-none"
            >
              <span suppressHydrationWarning>{isMac ? '⌘K' : 'Ctrl+K'}</span>
            </Badge>
          </div>

          <div className="mt-2 flex gap-2 sm:mt-0">
            <Button
              type="submit"
              variant="default"
              className="flex-grow self-center rounded-md px-8 py-2 font-bold shadow-lg transition duration-300 ease-in-out hover:scale-105 focus:outline-hidden sm:flex-grow-0"
              asChild
            >
              <Link
                href={{
                  pathname: '/templates',
                  query: { filter: filterTerm },
                }}
                className="flex items-center"
              >
                Textbausteine
              </Link>
            </Button>

            <Button
              variant="outline"
              className="hidden flex-grow self-center rounded-md px-8 py-2 font-bold shadow-lg transition duration-300 ease-in-out hover:scale-105 focus:outline-hidden md:flex-grow-0 xl:flex"
              asChild
            >
              <Link href="/aiscribe" className="flex items-center gap-2">
                <FileText className="size-4" />
                KI-Assistenz
              </Link>
            </Button>
          </div>
        </form>
      </div>
      {/*<!--Right Col-->*/}
      <div className="hidden w-full text-center md:block md:w-3/5">

        <Doctors />
      </div>
    </div>
  );
}
