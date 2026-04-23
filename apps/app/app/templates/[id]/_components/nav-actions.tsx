'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Clock,
  FileText,
  FolderPlus,
  ListChecks,
  Pencil,
  Share2,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/design-system/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';
import { Button } from '@repo/design-system/components/ui/button';
import { orpc } from '@/lib/orpc';

interface TemplateCollection {
  id: string;
  name: string;
  description: string | null;
  templates: { id: string }[];
}

export const NavActions = ({
  author,
  isAuthor,
  isFavourite,
  isLoggedIn,
  lastEdited,
  templateId,
  favouriteOfCount,
  contentView,
  hasExamples,
}: {
  author?: string;
  isAuthor: boolean;
  isFavourite: boolean;
  isLoggedIn: boolean;
  lastEdited: Date;
  templateId?: string;
  favouriteOfCount: number;
  contentView: 'template' | 'examples';
  hasExamples: boolean;
}) => {
  const templateActionIconProps = {
    className: 'h-4 w-4',
    strokeWidth: 1.5,
  } as const;
  const [isBookmark, setBookmark] = useState(isFavourite);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const collectionsQueryKey = orpc.user.collections.list.queryOptions().queryKey;
  const favouritesQueryKey = orpc.templates.favourites.queryOptions().queryKey;
  const templatesQueryKey = orpc.templates.list.queryOptions().queryKey;

  const invalidateCollections = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: collectionsQueryKey });
  }, [queryClient, collectionsQueryKey]);

  const invalidateTemplateLists = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: favouritesQueryKey }),
      queryClient.invalidateQueries({ queryKey: templatesQueryKey }),
    ]);
  }, [queryClient, favouritesQueryKey, templatesQueryKey]);

  const { data: collections = [] } = useQuery({
    ...orpc.user.collections.list.queryOptions(),
    enabled: isLoggedIn && Boolean(templateId),
  });

  const typedCollections = collections as TemplateCollection[];

  const collectionsContainingTemplate = useMemo(() => {
    if (!templateId) {
      return new Set<string>();
    }

    return new Set(
      typedCollections
        .filter((collection) =>
          collection.templates.some((collectionTemplate) => collectionTemplate.id === templateId)
        )
        .map((collection) => collection.id)
    );
  }, [templateId, typedCollections]);

  const favouriteMutation = useMutation({
    mutationFn: async (shouldBeFavourite: boolean) => {
      if (!templateId) {
        return;
      }

      await (
        shouldBeFavourite
          ? orpc.templates.addFavourite.call({ templateId })
          : orpc.templates.removeFavourite.call({ templateId })
      );
    },
    onSuccess: async (_, shouldBeFavourite) => {
      setBookmark(shouldBeFavourite);
      await invalidateTemplateLists();
    },
  });

  const addTemplateMutation = useMutation(
    orpc.user.collections.addTemplate.mutationOptions({
      onSuccess: async () => {
        await invalidateCollections();
      },
    })
  );

  const removeTemplateMutation = useMutation(
    orpc.user.collections.removeTemplate.mutationOptions({
      onSuccess: async () => {
        await invalidateCollections();
      },
    })
  );

  const handleToggleFavourite = useCallback(
    async (checked: boolean) => {
      if (!templateId || checked === isBookmark) {
        return;
      }

      try {
        await favouriteMutation.mutateAsync(checked);
        toast.success(checked ? 'Favorit gespeichert' : 'Favorit entfernt');
      } catch (error) {
        console.error('Error updating favourite:', error);
        toast.error('Fehler beim Aktualisieren der Favoriten');
      }
    },
    [templateId, isBookmark, favouriteMutation]
  );

  const handleToggleCollection = useCallback(
    async (collectionId: string, shouldInclude: boolean) => {
      if (!templateId) {
        return;
      }
      try {
        if (shouldInclude) {
          await addTemplateMutation.mutateAsync({ collectionId, templateId });
          toast.success('Zur Sammlung hinzugefügt');
        } else {
          await removeTemplateMutation.mutateAsync({ collectionId, templateId });
          toast.success('Aus Sammlung entfernt');
        }
      } catch (error) {
        console.error('Error updating collection:', error);
        toast.error('Fehler beim Aktualisieren der Sammlung');
      }
    },
    [templateId, addTemplateMutation, removeTemplateMutation]
  );

  const isCollectionMutationPending =
    addTemplateMutation.isPending || removeTemplateMutation.isPending;

  const handleToggleContentView = useCallback(() => {
    if (!hasExamples) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    const nextView = contentView === 'examples' ? 'template' : 'examples';

    if (nextView === 'examples') {
      nextSearchParams.set('view', 'examples');
    } else {
      nextSearchParams.delete('view');
    }

    const nextQuery = nextSearchParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [contentView, hasExamples, pathname, router, searchParams]);

  const contentViewTooltip = (() => {
    if (!hasExamples) {
      return 'Keine Beispiele vorhanden';
    }
    if (contentView === 'examples') {
      return 'Template anzeigen';
    }
    return 'Beispiele anzeigen';
  })();

  const handleDropdownItemSelect = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  const handleFavouriteCheckedChange = useCallback(
    async (checked: boolean) => {
      try {
        await handleToggleFavourite(Boolean(checked));
      } catch (error) {
        console.error('Error toggling favourite:', error);
      }
    },
    [handleToggleFavourite]
  );

  const collectionCheckedHandlers = useMemo(() => {
    const handlers: Record<string, (checked: boolean) => Promise<void>> = {};
    for (const collection of typedCollections) {
      handlers[collection.id] = async (checked: boolean) => {
        try {
          await handleToggleCollection(collection.id, Boolean(checked));
        } catch (error) {
          console.error('Error toggling collection:', error);
        }
      };
    }
    return handlers;
  }, [handleToggleCollection, typedCollections]);

  const editorAction = (() => {
    if (isLoggedIn && templateId) {
      if (isAuthor) {
        return (
          <Link href={`/templates/${templateId}/edit`}>
            <Button className="h-7 w-7" size="icon" variant="ghost">
              <Pencil {...templateActionIconProps} />
            </Button>
          </Link>
        );
      }

      return (
        <Link href={`/templates/create?fork=${templateId}`}>
          <Button className="h-7 w-7" size="icon" variant="ghost">
            <Share2 />
          </Button>
        </Link>
      );
    }

    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="#">
              <Pencil {...templateActionIconProps} />
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Nur für registrierte Nutzer</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  })();

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <User />
        Autor: {author || 'Anonym'}
      </div>

      <div className="hidden items-center font-medium text-muted-foreground lg:inline-flex lg:flex-row lg:gap-1">
        <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
        Zuletzt bearbeitet am{' '}
        {lastEdited &&
          new Date(lastEdited).toLocaleString('de-DE', {
            dateStyle: 'medium',
          })}
      </div>

      {isLoggedIn && templateId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-7 w-7" size="icon" variant="ghost">
              <FolderPlus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuCheckboxItem
              checked={isBookmark}
              disabled={favouriteMutation.isPending}
              onCheckedChange={handleFavouriteCheckedChange}
              onSelect={handleDropdownItemSelect}
            >
              <span className="font-medium">Favoriten</span>
            </DropdownMenuCheckboxItem>

            {typedCollections.length > 0 ? <DropdownMenuSeparator /> : null}

            {typedCollections.map((collection) => {
              const handleCollectionCheckedChange = collectionCheckedHandlers[collection.id];
              if (!handleCollectionCheckedChange) {
                return null;
              }

              return (
                <DropdownMenuCheckboxItem
                  checked={collectionsContainingTemplate.has(collection.id)}
                  className="items-start py-2"
                  disabled={isCollectionMutationPending}
                  key={collection.id}
                  onCheckedChange={handleCollectionCheckedChange}
                  onSelect={handleDropdownItemSelect}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{collection.name}</span>
                    {collection.description ? (
                      <span className="text-muted-foreground text-xs">
                        {collection.description}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="h-7 w-7"
              disabled={!hasExamples}
              onClick={handleToggleContentView}
              size="icon"
              type="button"
              variant={contentView === 'examples' ? 'secondary' : 'ghost'}
            >
              {contentView === 'examples' ? (
                <FileText className="h-4 w-4" />
              ) : (
                <ListChecks className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{contentViewTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {!isLoggedIn && <Bookmark {...templateActionIconProps} />}
      <span className="flex w-12 flex-row font-medium text-muted-foreground">
        {favouriteOfCount - (isFavourite ? 1 : 0) + (isBookmark ? 1 : 0)} Likes
      </span>
      {editorAction}
    </div>
  );
};
