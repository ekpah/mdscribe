"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Edit,
  FileText,
  GalleryVerticalEnd,
  LineChart,
  MoreHorizontal,
  Settings2,
  Star,
  Trash,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { auth } from "@/auth";
import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ClockIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { useSession } from "next-auth/react";

export function NavActions({
  template,
}: {
  template: Prisma.TemplateGetPayload<{}>;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isBookmark, setBookmark] = React.useState(false);
  const author = prisma.user.findUnique({
    where: {
      id: template.authorId,
    },
  });
  const { data: session } = useSession();
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden font-medium text-muted-foreground lg:flex-row lg:inline-flex items-center lg:gap-1">
        <PersonIcon />
        Autor: {author.then((author) => author?.email)}
      </div>

      <div className="hidden items-center font-medium text-muted-foreground lg:flex-row lg:inline-flex lg:gap-1">
        <ClockIcon />
        Zuletzt bearbeitet am{" "}
        {template?.updatedAt?.toLocaleDateString("de-DE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setBookmark(!isBookmark)}
      >
        {isBookmark ? <BookmarkFilledIcon /> : <BookmarkIcon />}
      </Button>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 data-[state=open]:bg-accent"
          >
            <MoreHorizontal />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 overflow-hidden rounded-lg p-0"
          align="end"
        >
          <Sidebar collapsible="none" className="bg-transparent">
            <SidebarContent>
              <SidebarGroup className="border-b last:border-none">
                <SidebarGroupContent className="gap-0">
                  <SidebarMenu>
                    <SidebarMenuItem>
                      {session?.user ? (
                        <SidebarMenuButton asChild>
                          <Link href={`/templates/${template?.id}/edit`}>
                            <Edit />
                            <span>Bearbeiten</span>
                          </Link>
                        </SidebarMenuButton>
                      ) : (
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SidebarMenuButton asChild>
                                <Link href="#">
                                  <Edit />
                                  <span>Bearbeiten</span>
                                </Link>
                              </SidebarMenuButton>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Nur für registrierte Nutzer</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </PopoverContent>
      </Popover>
    </div>
  );
}
