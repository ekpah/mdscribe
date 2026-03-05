'use client';

import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ClockIcon,
  Pencil2Icon,
  PersonIcon,
  Share1Icon,
} from '@radix-ui/react-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, MouseEvent } from 'react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { orpc } from '@/lib/orpc';
import { Button } from '@repo/design-system/components/ui/button';
import { Checkbox } from '@repo/design-system/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/design-system/components/ui/dialog';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';

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
}: {
  author?: string;
  isAuthor: boolean;
  isFavourite: boolean;
  isLoggedIn: boolean;
  lastEdited: Date;
  templateId?: string;
  favouriteOfCount: number;
}) => {
  const [isBookmark, setBookmark] = useState(isFavourite);
  const queryClient = useQueryClient();
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false);
  const [collectionForm, setCollectionForm] = useState({
    name: '',
    description: '',
  });

  const collectionsQueryKey = orpc.user.collections.list.queryOptions().queryKey;
  const invalidateCollections = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: collectionsQueryKey });
  }, [queryClient, collectionsQueryKey]);

  const { data: collections = [], isLoading: isCollectionsLoading } = useQuery({
    ...orpc.user.collections.list.queryOptions(),
    enabled: isLoggedIn && Boolean(templateId),
  });
  const typedCollections = collections as TemplateCollection[];

  const createCollectionMutation = useMutation(
    orpc.user.collections.create.mutationOptions()
  );
  const addTemplateMutation = useMutation(
    orpc.user.collections.addTemplate.mutationOptions({
      onSuccess: () => {
        void invalidateCollections();
      },
    })
  );
  const removeTemplateMutation = useMutation(
    orpc.user.collections.removeTemplate.mutationOptions({
      onSuccess: () => {
        void invalidateCollections();
      },
    })
  );

  const makeFavourite = useCallback(
    async (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      if (!templateId) {
        return;
      }
      setBookmark(true);
      await orpc.templates.addFavourite.call({ templateId });

      toast.success('Favorit gespeichert');
    },
    [templateId]
  );

  const unmakeFavourite = useCallback(
    async (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      if (!templateId) {
        return;
      }
      setBookmark(false);
      await orpc.templates.removeFavourite.call({ templateId });
      toast.success('Favorit entfernt');
    },
    [templateId]
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

  const handleCreateCollection = useCallback(async () => {
    if (!collectionForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen an');
      return;
    }
    try {
      const collection = await createCollectionMutation.mutateAsync({
        description: collectionForm.description,
        name: collectionForm.name,
      });

      await invalidateCollections();

      if (templateId) {
        await addTemplateMutation.mutateAsync({
          collectionId: collection.id,
          templateId,
        });
      }

      setCollectionForm({ name: '', description: '' });
      toast.success('Sammlung erstellt');
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Fehler beim Erstellen der Sammlung');
    }
  }, [
    addTemplateMutation,
    collectionForm.description,
    collectionForm.name,
    createCollectionMutation,
    invalidateCollections,
    templateId,
  ]);

  const handleCollectionDialogChange = useCallback((open: boolean) => {
    setIsCollectionDialogOpen(open);
    if (!open) {
      setCollectionForm({ name: '', description: '' });
    }
  }, []);

  const handleCloseCollectionDialog = useCallback(() => {
    setIsCollectionDialogOpen(false);
  }, []);

  const handleCollectionNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setCollectionForm((current) => ({
        ...current,
        name: event.target.value,
      }));
    },
    []
  );

  const handleCollectionDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setCollectionForm((current) => ({
        ...current,
        description: event.target.value,
      }));
    },
    []
  );

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

      {isLoggedIn && templateId && (
        <Dialog
          onOpenChange={handleCollectionDialogChange}
          open={isCollectionDialogOpen}
        >
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <FolderPlus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sammlungen</DialogTitle>
              <DialogDescription>
                Ordnen Sie diesen Textbaustein Sammlungen zu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 rounded-md border p-3">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">Name</Label>
                  <Input
                    id="collection-name"
                    maxLength={100}
                    onChange={handleCollectionNameChange}
                    placeholder="Neue Sammlung"
                    value={collectionForm.name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collection-description">Beschreibung</Label>
                  <Textarea
                    id="collection-description"
                    maxLength={500}
                    onChange={handleCollectionDescriptionChange}
                    placeholder="Optional"
                    value={collectionForm.description}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={createCollectionMutation.isPending}
                  onClick={handleCreateCollection}
                  type="button"
                  variant="outline"
                >
                  {createCollectionMutation.isPending
                    ? 'Sammlung wird erstellt...'
                    : 'Sammlung erstellen'}
                </Button>
              </div>
              <div className="space-y-2">
                {isCollectionsLoading && (
                  <div className="text-muted-foreground text-sm">
                    Lade Sammlungen...
                  </div>
                )}
                {!isCollectionsLoading && typedCollections.length === 0 && (
                  <div className="text-muted-foreground text-sm">
                    Keine Sammlungen vorhanden.
                  </div>
                )}
                {!isCollectionsLoading && typedCollections.length > 0 && (
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {typedCollections.map((collection) => {
                      const isInCollection = collection.templates.some(
                        (collectionTemplate) => collectionTemplate.id === templateId
                      );
                      return (
                        <label
                          className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm"
                          htmlFor={`collection-${collection.id}`}
                          key={collection.id}
                        >
                          <Checkbox
                            checked={isInCollection}
                            disabled={
                              addTemplateMutation.isPending ||
                              removeTemplateMutation.isPending
                            }
                            id={`collection-${collection.id}`}
                            onCheckedChange={(checked) => {
                              void handleToggleCollection(
                                collection.id,
                                Boolean(checked)
                              );
                            }}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{collection.name}</span>
                            {collection.description && (
                              <span className="text-muted-foreground text-xs">
                                {collection.description}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCloseCollectionDialog}
                type="button"
                variant="outline"
              >
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
