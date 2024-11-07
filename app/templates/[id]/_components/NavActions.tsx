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
  Pencil2Icon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { useSession } from "next-auth/react";

export function NavActions({
  author,
  template,
}: {
  author: Prisma.UserGetPayload<{}>;
  template: Prisma.TemplateGetPayload<{}>;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isBookmark, setBookmark] = React.useState(false);

  const { data: session } = useSession();
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden font-medium text-muted-foreground lg:flex-row lg:inline-flex items-center lg:gap-1">
        <PersonIcon />
        Autor: {author?.email}
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

      {session?.user ? (
        <Link href={`/templates/${template?.id}/edit`}>
          <Pencil2Icon />
        </Link>
      ) : (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="#">
                <Pencil2Icon />
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Nur für registrierte Nutzer</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
