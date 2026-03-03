'use client';

import {
  BookmarkFilledIcon,
  Pencil1Icon,
  PlusCircledIcon,
} from '@radix-ui/react-icons';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/design-system/components/ui/collapsible';
import { Kbd } from '@repo/design-system/components/ui/kbd';
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
  useSidebar,
} from '@repo/design-system/components/ui/sidebar';
import Fuse from 'fuse.js';
import { Library, Minus, Plus, Search, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import type React from 'react';
import { useRef, useState } from 'react';

import { useHotkeys } from 'react-hotkeys-hook';
import { CollectionSwitcher } from './collection-switcher';

interface Template {
  category: string;
  title: string;
  url: string;
  favouritesCount: number;
}

interface SidebarSegment {
  category: string;
  documents: { title: string; url: string; favouritesCount: number }[];
}

const generateSegments = ({ templates }: { templates: Template[] }) => {
  const segments = templates.reduce<SidebarSegment[]>((acc, current) => {
    const {category} = current;
    const template = current.title;
    const route = current.url;
    const {favouritesCount} = current;
    const existingCategory = acc.find(
      (segment) => segment.category === category
    );
    if (existingCategory) {
      existingCategory.documents.push({
        favouritesCount,
        title: template,
        url: route,
      });
    } else {
      acc.push({
        category,
        documents: [{ favouritesCount, title: template, url: route }],
      });
    }

    return acc;
  }, [] as SidebarSegment[]);

  return segments;
};

const formatCount = (count: number): string => {
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toString();
};

export default function AppSidebar({
  templates,
  favouriteTemplates,
  authoredTemplates,
  isLoggedIn,
}: {
  templates: string;
  favouriteTemplates: string;
  authoredTemplates: string;
  isLoggedIn: boolean;
}) {
  const { setOpenMobile } = useSidebar();

  const isMac =
    typeof window !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
  const router = useRouter();
  const showCreateTemplateButton = false;
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || '';
  const [searchTerm, setSearchTerm] = useState(initialFilter);
  const [activeCollection, setActiveCollection] = useQueryState(
    'activeCollection',
    { defaultValue: 'all' }
  );

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
          key: 'all',
          logo: Library,
          name: 'Alle Textbausteine',
        },
        {
          key: 'favourites',
          logo: BookmarkFilledIcon,
          name: 'Favoriten',
        },
        {
          key: 'authored',
          logo: Pencil1Icon,
          name: 'Von Dir erstellt',
        },
      ]
    : [
        {
          key: 'all',
          logo: Library,
          name: 'Alle Textbausteine',
        },
      ];

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e?.currentTarget?.value);
  };

  // 1. List of items to search in
  const menuSegments = JSON.parse(
    (() => {
      if (activeCollection === 'favourites') {
        return favouriteTemplates;
      }
      if (activeCollection === 'authored') {
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
    .search(searchTerm, { limit: 10 })
    .map((res) => res.item)
    .toSorted(
      (a, b) =>
        (b as Template).favouritesCount - (a as Template).favouritesCount
    );

  // generate ordered segments to be visualized in the sidebar
  const orderedSegments = generateSegments({
    templates: searchTerm ? filteredLinks : menuSegments,
  });

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const firstUrl = orderedSegments[0]?.documents[0]?.url;
    if (firstUrl) {
      router.push(firstUrl);
    }
  };

  return (
    <Sidebar className="top-16 mb-16 p-1 pb-20">
      <SidebarHeader className="z-30 gap-4">
        {isLoggedIn && (
          <CollectionSwitcher
            activeCollection={activeCollection}
            collections={collections}
            count={menuSegments?.length}
            setActiveCollection={setActiveCollection}
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
              <Label className="sr-only" htmlFor="search">
                Suchen
              </Label>
              <SidebarInput
                className="rounded-md bg-muted pl-8 text-sm"
                onChange={handleSearch}
                placeholder="Suchen..."
                ref={searchInputRef}
                type="search"
                value={searchTerm}
              />
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 select-none opacity-50" />
              <Kbd className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 select-none">
                <span suppressHydrationWarning>{isMac ? '⌘K' : 'Ctrl+K'}</span>
              </Kbd>
            </form>
          </SidebarGroupContent>
          {showCreateTemplateButton && (
            <SidebarGroupContent className="relative">
              <Link href="/templates/create">
                <Button className="w-full" variant="default">
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
                className="group/collapsible"
                defaultOpen={true}
                key={index}
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
                        {segment.documents.map((item, itemIndex) => (
                            <SidebarMenuSubItem key={itemIndex}>
                              <SidebarMenuSubButton asChild isActive={false}>
                                <Link
                                  className="flex items-center justify-between"
                                  href={`${item.url}?activeCollection=${encodeURIComponent(activeCollection)}`}
                                  onClick={() => {
                                    setOpenMobile(false);
                                  }}
                                >
                                  <span>{item.title}</span>
                                  {item.favouritesCount > 0 && (
                                    <span className="ml-2 flex items-center text-muted-foreground text-xs">
                                      <StarIcon className="mr-0.5 h-3 w-3" />
                                      {formatCount(item.favouritesCount)}
                                    </span>
                                  )}
                                </Link>
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
