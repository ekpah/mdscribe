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
import toast from "react-hot-toast";
import addFavourite from "../_actions/add-favourite";
import removeFavourite from "../_actions/remove-favourite";

// 1: Define a type that includes the relation to `Post`
const templateWithFavouritesOf = Prisma.validator<Prisma.TemplateDefaultArgs>()(
  {
    include: { favouriteOf: true },
  }
);

export function NavActions({
  author,
  template,
  isFavourite,
}: {
  author: Prisma.UserGetPayload<{}>;
  template: Prisma.TemplateGetPayload<typeof templateWithFavouritesOf>;
  isFavourite: boolean;
}) {
  const { data: session } = useSession();
  const [isBookmark, setBookmark] = React.useState(isFavourite);
  async function makeFavourite(event) {
    event.preventDefault();
    setBookmark(true);
    await addFavourite(template);

    toast.success("Favorit gespeichert"); // Displays a success message
  }
  async function unmakeFavourite(event) {
    event.preventDefault();
    setBookmark(false);
    await removeFavourite(template);
    toast.success("Favorit entfernt"); // Displays a success message
  }

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

      {isBookmark ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => unmakeFavourite(e)}
        >
          <BookmarkFilledIcon />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => makeFavourite(e)}
        >
          <BookmarkIcon />
        </Button>
      )}
      <span className="flex flex-row w-12 font-medium text-muted-foreground">
        {template?.favouriteOf.length -
          (isFavourite ? 1 : 0) +
          (isBookmark ? 1 : 0)}{" "}
        Likes
      </span>
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
