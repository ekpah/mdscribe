'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@repo/design-system/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@repo/design-system/components/ui/sidebar';
import { ChevronDown, Command } from 'lucide-react';
import type React from 'react';

export function CollectionSwitcher({
  collections = [
    {
      name: 'Meine Textbausteine',
      logo: Command,
      key: 'authored',
    },
  ],
  count,
  activeCollection,
  setActiveCollection,
}: {
  collections: {
    name: string;
    logo: React.ElementType;
    key: string;
  }[];
  count: number;
  activeCollection: string;
  setActiveCollection: (collection: string) => void;
}) {
  const activeCollectionItem =
    collections.find((collection) => collection.key === activeCollection) ??
    collections[0];
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-fit px-1.5">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {(() => {
                  if (activeCollectionItem?.logo) {
                    const Logo = activeCollectionItem.logo;
                    return <Logo className="size-4" />;
                  }
                  return null;
                })()}
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">
                  {
                    activeCollectionItem?.name
                  }
                </span>
                <span className="">
                  {count} {count === 1 ? 'Dokument' : 'Dokumente'}
                </span>
              </div>
              <ChevronDown className="opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64 rounded-lg"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Textbausteine
            </DropdownMenuLabel>
            {collections.map((collection) => (
              <DropdownMenuItem
                className="gap-2 p-2"
                key={collection.key}
                onClick={() => setActiveCollection(collection.key)}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <collection.logo className="size-4 shrink-0" />
                </div>
                {collection.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
