'use client';

import { ChevronDown, Command, Plus } from 'lucide-react';
import React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/design-system/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@repo/design-system/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';

export function CollectionSwitcher({
  collections = [
    {
      name: 'Meine Textbausteine',
      logo: Command,
      plan: 'Enterprise',
    },
  ],
  count,
  activeCollectionIndex,
  setActiveCollectionIndex,
}: {
  collections: {
    name: string;
    logo: React.ElementType;
    plan: string;
  }[];
  count: number;
  activeCollectionIndex: number;
  setActiveCollectionIndex: (index: number) => void;
}) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-fit px-1.5">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {React.createElement(collections[activeCollectionIndex].logo, {
                  className: 'size-4',
                })}
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">
                  {collections[activeCollectionIndex].name}
                </span>
                <span className="">
                  {count} {count === 1 ? 'Dokument' : 'Dokumente'}
                </span>
              </div>
              <ChevronDown className="opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Textbausteine
            </DropdownMenuLabel>
            {collections.map((collection, index) => (
              <DropdownMenuItem
                key={collection.name}
                onClick={() => setActiveCollectionIndex(index)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <collection.logo className="size-4 shrink-0" />
                </div>
                {collection.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="font-medium text-muted-foreground">
                      Sammlung hinzufügen
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Coming soon!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
