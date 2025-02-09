import Doctors from '@/public/landing/Doctors';
import { Badge } from '@repo/design-system/components/ui/badge';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Search } from 'lucide-react';
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

  return (
    <div className="flex h-[screen] flex-col flex-wrap items-center px-3 md:flex-row">
      {/*<!--Left Col-->*/}
      <div className="flex w-full flex-col items-start justify-center px-3 py-6 text-center md:w-2/5 md:py-3 md:text-left">
        <p className="w-full uppercase tracking-loose">
          Warum kann es nicht einfach sein?
        </p>
        <h1 className="my-4 font-bold text-5xl leading-tight">
          Arztbriefe erstellen ohne sich zu wiederholen
        </h1>
        <p className="mb-8 text-2xl leading-normal">
          Nutze schlaue Textbausteine, die sich ohne viel Aufwand immer wieder
          verwenden lassen
        </p>
        <form
          className="relative flex flex-row gap-2"
          action="/templates?filter="
        >
          <div className="relative">
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

          <Button
            type="submit"
            variant="secondary"
            className="self-center rounded-full px-8 py-4 font-bold shadow-lg transition duration-300 ease-in-out hover:scale-105 focus:outline-hidden md:self-start lg:mx-0"
            asChild
          >
            <Link
              href={{
                pathname: '/templates',
                query: { filter: filterTerm },
              }}
              className="flex items-center"
            >
              Ausprobieren
            </Link>
          </Button>
        </form>
      </div>
      {/*<!--Right Col-->*/}
      <div className="w-full text-center md:w-3/5">
        <Doctors />
      </div>
      {/* 
        div className="relative -mt-12 lg:-mt-24">
        <HeroDivider />
      </div>*/}
    </div>
  );
}
