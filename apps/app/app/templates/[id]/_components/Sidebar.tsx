'use client';

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

import { Library } from 'lucide-react';

import Fuse from 'fuse.js';
import { Minus, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { PlusCircledIcon } from '@radix-ui/react-icons';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/design-system/components/ui/collapsible';
import { Label } from '@repo/design-system/components/ui/label';
import type React from 'react';
import { useState } from 'react';
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

const collections = [
  {
    name: 'Meine Favoriten',
    logo: Library,
    plan: 'Enterprise',
  },
];

export default function AppSidebar({
  templates,
  isLoggedIn,
}: { templates: string; isLoggedIn: boolean }) {
  const showCreateTemplateButton = false;
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || '';
  const [searchTerm, setSearchTerm] = useState(initialFilter);
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e?.currentTarget?.value);
  };

  // 1. List of items to search in
  const menuSegments = JSON.parse(templates);

  // 2. Set up the Fuse instance
  const fuse = new Fuse(menuSegments, {
    keys: ['category', 'template'],
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
    <Sidebar className="top-16 p-1">
      <SidebarHeader className="z-30 gap-4">
        {isLoggedIn && (
          <CollectionSwitcher
            collections={collections}
            count={menuSegments?.length}
          />
        )}
        <form key="search">
          <SidebarGroup className="gap-2 py-0">
            <SidebarGroupContent className="relative">
              <Label htmlFor="search" className="sr-only">
                Search
              </Label>
              <SidebarInput
                type="search"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={handleSearch}
                className="rounded-md bg-muted pl-8 text-sm"
              />
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 select-none opacity-50" />
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
        </form>
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
