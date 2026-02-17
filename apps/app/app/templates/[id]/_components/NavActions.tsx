'use client';
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
import Link from 'next/link';
import React from 'react';
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ClockIcon,
  Pencil2Icon,
  PersonIcon,
  Share1Icon,
} from '@radix-ui/react-icons';
import { FolderPlus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/design-system/components/ui/tooltip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { orpc } from '@/lib/orpc';

interface TemplateCollection {
  id: string;
  name: string;
  description: string | null;
  templates: { id: string }[];
}

export function NavActions({
  author,
  isAuthor,
  isFavourite,
  isLoggedIn,
  lastEdited,
  templateId,
  favouriteOfCount,
}: {
  author?: string; //email of the author
  isAuthor: boolean;
  isFavourite: boolean;
  isLoggedIn: boolean;
  lastEdited: Date;
  templateId?: string;
  favouriteOfCount: number;
}) {
  const [isBookmark, setBookmark] = React.useState(isFavourite);
  const queryClient = useQueryClient();
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] =
    React.useState(false);
  const [collectionForm, setCollectionForm] = React.useState({
    name: '',
    description: '',
  });

  const collectionsQueryKey =
    orpc.user.collections.list.queryOptions().queryKey;

  const { data: collections = [], isLoading: isCollectionsLoading } =
    useQuery({
      ...orpc.user.collections.list.queryOptions(),
      enabled: isLoggedIn && Boolean(templateId),
    });

  const createCollectionMutation = useMutation(
    orpc.user.collections.create.mutationOptions()
  );
  const addTemplateMutation = useMutation(
    orpc.user.collections.addTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: collectionsQueryKey });
      },
    })
  );
  const removeTemplateMutation = useMutation(
    orpc.user.collections.removeTemplate.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: collectionsQueryKey });
      },
    })
  );
  async function makeFavourite(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    if (!templateId) {
      return;
    }
    setBookmark(true);
    await orpc.templates.addFavourite.call({ templateId });

    toast.success('Favorit gespeichert'); // Displays a success message
  }
  async function unmakeFavourite(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    if (!templateId) {
      return;
    }
    setBookmark(false);
    await orpc.templates.removeFavourite.call({ templateId });
    toast.success('Favorit entfernt'); // Displays a success message
  }

  const handleToggleCollection = async (
    collectionId: string,
    shouldInclude: boolean
  ) => {
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
  };

  const handleCreateCollection = async () => {
    if (!collectionForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen an');
      return;
    }
    try {
      const collection = await createCollectionMutation.mutateAsync({
        name: collectionForm.name,
        description: collectionForm.description,
      });

      await queryClient.invalidateQueries({ queryKey: collectionsQueryKey });

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
  };

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
      {isLoggedIn && templateId && (
        <Dialog
          onOpenChange={(open) => {
            setIsCollectionDialogOpen(open);
            if (!open) {
              setCollectionForm({ name: '', description: '' });
            }
          }}
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
                Ordnen Sie dieses Template Sammlungen zu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2 rounded-md border p-3">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">Name</Label>
                  <Input
                    id="collection-name"
                    maxLength={100}
                    onChange={(event) =>
                      setCollectionForm({
                        ...collectionForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="Neue Sammlung"
                    value={collectionForm.name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collection-description">Beschreibung</Label>
                  <Textarea
                    id="collection-description"
                    maxLength={500}
                    onChange={(event) =>
                      setCollectionForm({
                        ...collectionForm,
                        description: event.target.value,
                      })
                    }
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
                {!isCollectionsLoading && collections.length === 0 && (
                  <div className="text-muted-foreground text-sm">
                    Keine Sammlungen vorhanden.
                  </div>
                )}
                {!isCollectionsLoading && collections.length > 0 && (
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {(collections as TemplateCollection[]).map((collection) => {
                      const isInCollection = collection.templates.some(
                        (collectionTemplate) =>
                          collectionTemplate.id === templateId
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
                            onCheckedChange={(checked) =>
                              handleToggleCollection(
                                collection.id,
                                Boolean(checked)
                              )
                            }
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
                onClick={() => setIsCollectionDialogOpen(false)}
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
}
