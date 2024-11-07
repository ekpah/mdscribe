"use client";

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
} from "@/components/ui/sidebar";

import { Library } from "lucide-react";

import Fuse from "fuse.js";
import { Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Label } from "@/components/ui/label";
import { useState } from "react";
import { CollectionSwitcher } from "./CollectionSwitcher";

const generateSegments = (templates) => {
  const segments = templates.reduce((acc, current) => {
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
  }, []);

  return segments;
};

const collections = [
  {
    name: "Meine Favoriten",
    logo: Library,
    plan: "Enterprise",
  },
];

export default function AppSidebar({ templates }) {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") || "";
  const [searchTerm, setSearchTerm] = useState(initialFilter);
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // 1. List of items to search in
  const menuSegments = JSON.parse(templates);
  console.log(menuSegments.length);
  // 2. Set up the Fuse instance
  const fuse = new Fuse(menuSegments, {
    keys: ["category", "template"],
  });

  // 3. Now search!
  const filteredLinks = fuse
    .search(searchTerm, { limit: 5 })
    .map((res) => res.item);

  // generate ordered segments to be visualized in the sidebar
  const orderedSegments = generateSegments(
    searchTerm ? filteredLinks : menuSegments
  );
  return (
    <Sidebar className="top-16 p-1">
      <SidebarHeader className="z-30 gap-4">
        <CollectionSwitcher
          collections={collections}
          count={menuSegments?.length}
        />
        <form key="search">
          <SidebarGroup className="py-0">
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
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50" />
            </SidebarGroupContent>
          </SidebarGroup>
        </form>
      </SidebarHeader>
      <SidebarContent
        className="gap-6 custom-scrollbar text-xl"
        style={{ scrollbarWidth: "none" }}
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
                    <SidebarMenuButton className="text-lg text-foreground font-semibold">
                      {segment.category || "Diverses"}
                      <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {segment.documents?.length ? (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {segment.documents.map((item, index) => (
                          <SidebarMenuSubItem key={index}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={item.isActive}
                            >
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
