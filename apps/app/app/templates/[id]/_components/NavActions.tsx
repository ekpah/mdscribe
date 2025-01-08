'use client';
import { Button } from '@repo/design-system/components/ui/button';
import Link from 'next/link';
import React from 'react';

import type { Prisma } from '@repo/database';

import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ClockIcon,
  Pencil2Icon,
  PersonIcon,
} from '@radix-ui/react-icons';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';
import type { Session } from 'next-auth';
import toast from 'react-hot-toast';
import addFavourite from '../_actions/add-favourite';
import removeFavourite from '../_actions/remove-favourite';

// 1: Define a type that includes the relation to `Post`

export function NavActions({
  author,
  template,
  isFavourite,
  session,
}: {
  author: Prisma.UserCreateInput;
  template: Prisma.TemplateGetPayload<{
    include: { favouriteOf: true };
  }>;
  isFavourite: boolean;
  session: Session | null;
}) {
  const [isBookmark, setBookmark] = React.useState(isFavourite);
  async function makeFavourite(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    setBookmark(true);
    await addFavourite({ template });

    toast.success('Favorit gespeichert'); // Displays a success message
  }
  async function unmakeFavourite(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    setBookmark(false);
    await removeFavourite({ template });
    toast.success('Favorit entfernt'); // Displays a success message
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <PersonIcon />
        Autor: {author?.email}
      </div>

      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <ClockIcon />
        Zuletzt bearbeitet am{' '}
        {template?.updatedAt?.toLocaleString('de-DE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
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
      <span className="flex w-12 flex-row font-medium text-muted-foreground">
        {template?.favouriteOf?.length -
          (isFavourite ? 1 : 0) +
          (isBookmark ? 1 : 0)}{' '}
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
