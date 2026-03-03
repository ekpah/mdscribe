"use client";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ClockIcon,
  Pencil2Icon,
  PersonIcon,
  Share1Icon,
} from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

// 1: Define a type that includes the relation to `Post`

export const NavActions = ({
  author,
  isAuthor,
  isFavourite,
  isLoggedIn,
  lastEdited,
  templateId,
  favouriteOfCount,
}: {
  // email of the author
  author?: string;
  isAuthor: boolean;
  isFavourite: boolean;
  isLoggedIn: boolean;
  lastEdited: Date;
  templateId?: string;
  favouriteOfCount: number;
}) => {
  const [isBookmark, setBookmark] = useState(isFavourite);
  const makeFavourite = useCallback(async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (!templateId) {
      return;
    }
    setBookmark(true);
    await orpc.templates.addFavourite.call({ templateId });

    toast.success("Favorit gespeichert");
  }, [templateId]);
  const unmakeFavourite = useCallback(async (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (!templateId) {
      return;
    }
    setBookmark(false);
    await orpc.templates.removeFavourite.call({ templateId });
    toast.success("Favorit entfernt");
  }, [templateId]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <PersonIcon />
        Autor: {author || "Anonym"}
      </div>

      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <ClockIcon />
        Zuletzt bearbeitet am{" "}
        {lastEdited &&
          new Date(lastEdited).toLocaleString("de-DE", {
            dateStyle: "medium",
          })}
      </div>

      {isLoggedIn &&
        templateId &&
        (isBookmark ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={unmakeFavourite}
          >
            <BookmarkFilledIcon />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={makeFavourite}
          >
            <BookmarkIcon />
          </Button>
        ))}
      {!isLoggedIn && <BookmarkIcon />}
      <span className="flex w-12 flex-row font-medium text-muted-foreground">
        {favouriteOfCount - (isFavourite ? 1 : 0) + (isBookmark ? 1 : 0)} Likes
      </span>
      {isLoggedIn && templateId ? (
        isAuthor ? (
          <Link href={`/templates/${templateId}/edit`}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil2Icon />
            </Button>
          </Link>
        ) : (
          <Link href={`/templates/create?fork=${templateId}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Share1Icon />
            </Button>
          </Link>
        )
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
};
