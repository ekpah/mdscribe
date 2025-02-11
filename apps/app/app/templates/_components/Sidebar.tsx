'use client';

import {
  BookmarkFilledIcon,
  Pencil1Icon,
  PlusCircledIcon,
} from '@radix-ui/react-icons';
import { Badge } from '@repo/design-system/components/ui/badge';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/design-system/components/ui/collapsible';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@repo/design-system/components/ui/sidebar';
import Fuse from 'fuse.js';
import { Library, Minus, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useRef, useState } from 'react';

import { useHotkeys } from 'react-hotkeys-hook';

import { useSession } from '@repo/auth/lib/auth-client';
import { CollectionSwitcher } from './CollectionSwitcher';

interface Template {
  category: string;
  title: string;
  url: string;
}

interface SidebarSegment {
  category: string;
  documents: { title: string; url: string }[];
}

const generateSegments = ({ templates }: { templates: Template[] }) => {
  const segments = templates.reduce<SidebarSegment[]>((acc, current) => {
    const category = current.category;
    const template = current.title;
    const route = current.url;

    const existingCategory = acc.find(
      (segment) => segment.category === category
    );
    if (existingCategory) {
      existingCategory.documents.push({ title: template, url: route });
    } else {
      acc.push({ category, documents: [{ title: template, url: route }] });
    }

    return acc;
  }, [] as SidebarSegment[]);

  return segments;
};

export default function AppSidebar({
  templates,
  favouriteTemplates,
  authoredTemplates,
}: {
  templates: string;
  favouriteTemplates: string;
  authoredTemplates: string;
}) {
  const { data: session } = useSession();

  const isLoggedIn = !!session?.user;
  const isMac =
    typeof window !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
  const router = useRouter();
  const showCreateTemplateButton = false;
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || '';
  const [searchTerm, setSearchTerm] = useState(initialFilter);
  const [activeCollectionIndex, setActiveCollectionIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useHotkeys(['meta+k', 'ctrl+k'], (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.value = '';
    }
  });

  // collections depending on if the user is logged in or not
  const collections = isLoggedIn
    ? [
        {
          name: 'Favoriten',
          logo: BookmarkFilledIcon,
          plan: 'favourites',
        },
        {
          name: 'Von Dir erstellt',
          logo: Pencil1Icon,
          plan: 'author',
        },
        {
          name: 'Alle Textbausteine',
          logo: Library,
          plan: 'all',
        },
      ]
    : [
        {
          name: 'Alle Textbausteine',
          logo: Library,
          plan: 'all',
        },
      ];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e?.currentTarget?.value);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`${orderedSegments[0].documents[0].url}`);
  };
  // 1. List of items to search in
  const menuSegments = JSON.parse(
    (() => {
      if (collections[activeCollectionIndex].name === 'Favoriten') {
        return favouriteTemplates;
      }
      if (collections[activeCollectionIndex].name === 'Von Dir erstellt') {
        return authoredTemplates;
      }
      return templates;
    })()
  );

  // 2. Set up the Fuse instance
  const fuse = new Fuse(menuSegments, {
    keys: ['category', 'title'],
  });

  // 3. Now search!
  const filteredLinks = fuse
    .search(searchTerm, { limit: 5 })
    .map((res) => res.item);

  // generate ordered segments to be visualized in the sidebar
  const orderedSegments = generateSegments({
    templates: searchTerm ? filteredLinks : menuSegments,
  });

  return (
    <Sidebar className="top-16 mb-16 p-1 pb-20">
      <SidebarHeader className="z-30 gap-4">
        {isLoggedIn && (
          <CollectionSwitcher
            collections={collections}
            count={menuSegments?.length}
            activeCollectionIndex={activeCollectionIndex}
            setActiveCollectionIndex={setActiveCollectionIndex}
          />
        )}

        <SidebarGroup className="gap-2 py-0">
          <SidebarGroupContent className="relative">
            {isLoggedIn && (
              <Link href="/templates/create">
                <Button className="w-full justify-start gap-2 px-2">
                  <Plus className="h-4 w-4" />
                  <span>Neue Vorlage</span>
                </Button>
              </Link>
            )}
          </SidebarGroupContent>
          <SidebarGroupContent className="relative">
            <form key="search" onSubmit={handleSearchSubmit}>
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <SidebarInput
                type="search"
                placeholder="Suchen..."
                value={searchTerm}
                ref={searchInputRef}
                onChange={handleSearch}
                className="rounded-md bg-muted pl-8 text-sm"
              />
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 select-none opacity-50" />
              <Badge
                variant="secondary"
                className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 select-none"
              >
                <span suppressHydrationWarning>{isMac ? '⌘K' : 'Ctrl+K'}</span>
              </Badge>
            </form>
          </SidebarGroupContent>
          {showCreateTemplateButton && (
            <SidebarGroupContent className="relative">
              <Link href={'/templates/create'}>
                <Button variant={'default'} className="w-full">
                  <PlusCircledIcon className="mr-2 h-4 w-4" />
                  Neuer Textbaustein
                </Button>
              </Link>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarHeader>
      <SidebarContent
        className="custom-scrollbar gap-6 text-xl"
        style={{ scrollbarWidth: 'none' }}
      >
        <SidebarGroup>
          <SidebarMenu>
            {orderedSegments.map((segment, index) => (
              <Collapsible
                key={index}
                defaultOpen={true}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="font-semibold text-foreground text-lg">
                      {segment.category || 'Diverses'}
                      <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {segment.documents?.length ? (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {segment.documents.map((item, index) => (
                          <SidebarMenuSubItem key={index}>
                            <SidebarMenuSubButton asChild isActive={false}>
                              <Link href={item.url}>{item.title}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  ) : null}
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
