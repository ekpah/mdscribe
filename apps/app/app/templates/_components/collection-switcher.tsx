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
import { useMemo } from 'react';
import { useSession } from '@/lib/auth-client';

export const CollectionSwitcher = ({
  collections = [
    {
      key: 'authored',
      logo: Command,
      name: 'Meine Textbausteine',
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
}) => {
  const { data: session } = useSession();
  const _isLoggedIn = !!session?.user?.id;
  const activeCollectionItem = useMemo(
    () => collections.find((collection) => collection.key === activeCollection),
    [collections, activeCollection],
  );
  const collectionClickHandlers = useMemo(
    () =>
      Object.fromEntries(
        collections.map((collection) => [
          collection.key,
          () => {
            setActiveCollection(collection.key);
          },
        ]),
      ) as Record<string, () => void>,
    [collections, setActiveCollection],
  );
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-fit px-1.5">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeCollectionItem?.logo ? (
                  <activeCollectionItem.logo className="size-4" />
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">
                  {activeCollectionItem?.name}
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
                key={collection.name}
                onClick={collectionClickHandlers[collection.key]}
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
};
