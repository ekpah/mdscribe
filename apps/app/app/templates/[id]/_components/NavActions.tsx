'use client';
import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';
import React from 'react';

import { useSession } from '@/lib/auth-client';
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ClockIcon,
  Pencil2Icon,
  PersonIcon,
  Share1Icon,
} from '@radix-ui/react-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';
import toast from 'react-hot-toast';
import addFavourite from '../../_actions/add-favourite';
import removeFavourite from '../../_actions/remove-favourite';

// 1: Define a type that includes the relation to `Post`

export function NavActions({
  author,
  isFavourite,
  isLoggedIn,
  lastEdited,
  templateId,
  favouriteOfCount,
}: {
  author?: string; //email of the author
  isFavourite: boolean;
  isLoggedIn: boolean;
  lastEdited: Date;
  templateId?: string;
  favouriteOfCount: number;
}) {
  const [isBookmark, setBookmark] = React.useState(isFavourite);
  const { data: session } = useSession();
  async function makeFavourite(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    if (!templateId) {
      return;
    }
    setBookmark(true);
    await addFavourite({ templateId });

    toast.success('Favorit gespeichert'); // Displays a success message
  }
  async function unmakeFavourite(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    if (!templateId) {
      return;
    }
    setBookmark(false);
    await removeFavourite({ templateId });
    toast.success('Favorit entfernt'); // Displays a success message
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <PersonIcon />
        Autor: {author || 'Anonym'}
      </div>

      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <ClockIcon />
        Zuletzt bearbeitet am{' '}
        {lastEdited &&
          new Date(lastEdited).toLocaleString('de-DE', {
            dateStyle: 'medium',
          })}
      </div>

      {isLoggedIn &&
        templateId &&
        (isBookmark ? (
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
        ))}
      {!isLoggedIn && <BookmarkIcon />}
      <span className="flex w-12 flex-row font-medium text-muted-foreground">
        {favouriteOfCount - (isFavourite ? 1 : 0) + (isBookmark ? 1 : 0)} Likes
      </span>
      {isLoggedIn && templateId ? (
        author === session?.user?.email ? (
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
}
