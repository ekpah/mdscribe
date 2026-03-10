'use client';

import {
  BookmarkFilledIcon,
  Pencil1Icon,
  PlusCircledIcon,
} from '@radix-ui/react-icons';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/design-system/components/ui/collapsible';
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
import { Kbd } from '@repo/design-system/components/ui/kbd';
import { Label } from '@repo/design-system/components/ui/label';
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
  useSidebar,
} from '@repo/design-system/components/ui/sidebar';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import {
  Folder,
  FolderPlus,
  Library,
  Minus,
  Plus,
  Search,
  StarIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryState } from 'nuqs';
import type React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { orpc } from '@/lib/orpc';
import { CollectionSwitcher } from './collection-switcher';

interface Template {
  category: string;
  title: string;
  url: string;
  favouritesCount: number;
}

interface CustomCollection {
  id: string;
  name: string;
  description: string | null;
  templates: {
    id: string;
    title: string;
    category: string;
    favouritesCount: number;
  }[];
}

interface SidebarSegment {
  category: string;
  documents: { title: string; url: string; favouritesCount: number }[];
}

const generateSegments = ({ templates }: { templates: Template[] }) => {
  const segments = templates.reduce<SidebarSegment[]>((acc, current) => {
    const { category } = current;
    const template = current.title;
    const route = current.url;
    const { favouritesCount } = current;
    const existingCategory = acc.find(
      (segment) => segment.category === category
    );
    if (existingCategory) {
      existingCategory.documents.push({
        favouritesCount,
        title: template,
        url: route,
      });
    } else {
      acc.push({
        category,
        documents: [{ favouritesCount, title: template, url: route }],
      });
    }

    return acc;
  }, [] as SidebarSegment[]);

  return segments;
};

const formatCount = (count: number): string => {
  if (count >= 1_000_000_000) {
    return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return count.toString();
};

export default function AppSidebar({
  templates,
  favouriteTemplates,
  authoredTemplates,
  customCollections,
  isLoggedIn,
}: {
  templates: string;
  favouriteTemplates: string;
  authoredTemplates: string;
  customCollections: string;
  isLoggedIn: boolean;
}) {
  const { setOpenMobile } = useSidebar();

  const isMac =
    typeof window !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
  const router = useRouter();
  const showCreateTemplateButton = false;
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter') || '';
  const [searchTerm, setSearchTerm] = useState(initialFilter);
  const [activeCollection, setActiveCollection] = useQueryState(
    'activeCollection',
    { defaultValue: 'all' }
  );

  const queryClient = useQueryClient();
  const initialTemplates = useMemo(
    () => JSON.parse(templates) as Template[],
    [templates]
  );
  const initialFavouriteTemplates = useMemo(
    () => JSON.parse(favouriteTemplates) as Template[],
    [favouriteTemplates]
  );
  const initialAuthoredTemplates = useMemo(
    () => JSON.parse(authoredTemplates) as Template[],
    [authoredTemplates]
  );
  const initialCustomCollections = useMemo(
    () => JSON.parse(customCollections) as CustomCollection[],
    [customCollections]
  );

  const { data: customCollectionsData = initialCustomCollections } = useQuery({
    ...orpc.user.collections.list.queryOptions(),
    enabled: isLoggedIn,
    initialData: initialCustomCollections,
  });

  const customCollectionsWithUrls = useMemo(
    () =>
      customCollectionsData.map((collection) => ({
        ...collection,
        templates: collection.templates.map((collectionTemplate) => ({
          ...collectionTemplate,
          url: `/templates/${collectionTemplate.id}`,
        })),
      })),
    [customCollectionsData]
  );

  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [collectionForm, setCollectionForm] = useState({
    name: '',
    description: '',
  });

  const createCollectionMutation = useMutation(
    orpc.user.collections.create.mutationOptions({
      onSuccess: (collection) => {
        queryClient.invalidateQueries({
          queryKey: orpc.user.collections.list.queryOptions().queryKey,
        });
        setCollectionForm({ name: '', description: '' });
        setIsCreateCollectionOpen(false);
        setActiveCollection(collection.id);
        toast.success('Sammlung erstellt');
      },
    })
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  useHotkeys(['meta+k', 'ctrl+k'], (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.value = '';
    }
  });

  const baseCollections = [
    {
      key: 'all',
      logo: Library,
      name: 'Alle Textbausteine',
    },
  ];

  const userCollections = isLoggedIn
    ? [
        {
          key: 'favourites',
          logo: BookmarkFilledIcon,
          name: 'Favoriten',
        },
        {
          key: 'authored',
          logo: Pencil1Icon,
          name: 'Von Dir erstellt',
        },
      ]
    : [];

  const customCollectionEntries = useMemo(
    () =>
      customCollectionsWithUrls.map((collection) => ({
        key: collection.id,
        logo: Folder,
        name: collection.name,
      })),
    [customCollectionsWithUrls]
  );

  const collections = isLoggedIn
    ? [...baseCollections, ...userCollections, ...customCollectionEntries]
    : baseCollections;

  const activeCollectionValue = collections.some(
    (collection) => collection.key === activeCollection
  )
    ? activeCollection
    : 'all';

  useEffect(() => {
    if (activeCollectionValue !== activeCollection) {
      setActiveCollection(activeCollectionValue);
    }
  }, [activeCollection, activeCollectionValue, setActiveCollection]);

  const handleSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
  }, []);

  const handleCloseCreateCollection = useCallback(() => {
    setIsCreateCollectionOpen(false);
    setCollectionForm({ name: '', description: '' });
  }, []);

  const handleCreateCollection = useCallback(async () => {
    if (!collectionForm.name.trim()) {
      toast.error('Bitte geben Sie einen Namen an');
      return;
    }

    try {
      await createCollectionMutation.mutateAsync({
        description: collectionForm.description,
        name: collectionForm.name,
      });
    } catch (error) {
      console.error('Error creating collection:', error);
      toast.error('Fehler beim Erstellen der Sammlung');
    }
  }, [
    collectionForm.description,
    collectionForm.name,
    createCollectionMutation,
  ]);

  const handleCreateCollectionDialogChange = useCallback((open: boolean) => {
    setIsCreateCollectionOpen(open);
    if (!open) {
      setCollectionForm({ name: '', description: '' });
    }
  }, []);

  const handleCollectionNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setCollectionForm((current) => ({
        ...current,
        name: event.target.value,
      }));
    },
    []
  );

  const handleCollectionDescriptionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCollectionForm((current) => ({
        ...current,
        description: event.target.value,
      }));
    },
    []
  );

  const activeCustomCollection = customCollectionsWithUrls.find(
    (collection) => collection.id === activeCollectionValue
  );

  const menuSegments =
    activeCollectionValue === 'favourites'
      ? initialFavouriteTemplates
      : activeCollectionValue === 'authored'
        ? initialAuthoredTemplates
        : activeCollectionValue === 'all'
          ? initialTemplates
          : activeCustomCollection?.templates ?? [];

  const fuse = new Fuse(menuSegments, {
    keys: ['category', 'title'],
  });

  const filteredLinks = fuse
    .search(searchTerm, { limit: 10 })
    .map((res) => res.item)
    .toSorted(
      (a, b) =>
        (b as Template).favouritesCount - (a as Template).favouritesCount
    );

  const orderedSegments = generateSegments({
    templates: searchTerm ? filteredLinks : menuSegments,
  });

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const firstUrl = orderedSegments[0]?.documents[0]?.url;
      if (firstUrl) {
        router.push(firstUrl);
      }
    },
    [orderedSegments, router]
  );

  const handleCloseMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  return (
    <Sidebar className="top-16 mb-16 p-1 pb-20">
      <SidebarHeader className="z-30 gap-4">
        {isLoggedIn && (
          <CollectionSwitcher
            activeCollection={activeCollectionValue}
            collections={collections}
            count={menuSegments.length}
            setActiveCollection={setActiveCollection}
          />
        )}
        <SidebarGroup className="gap-2 py-0">
          <SidebarGroupContent className="relative">
            {isLoggedIn && (
              <Link href="/templates/create">
                <Button className="w-full justify-start gap-2 px-2">
                  <Plus className="h-4 w-4" />
                  <span>Neue Vorlage</span>
                </Button>
              </Link>
            )}
          </SidebarGroupContent>
          {isLoggedIn && (
            <SidebarGroupContent className="relative">
              <Dialog
                onOpenChange={handleCreateCollectionDialogChange}
                open={isCreateCollectionOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    className="w-full justify-start gap-2 px-2"
                    type="button"
                    variant="outline"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>Neue Sammlung</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Neue Sammlung</DialogTitle>
                    <DialogDescription>
                      Erstellen Sie eine Sammlung für Ihre Textbausteine.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="collection-name">Name</Label>
                      <Input
                        id="collection-name"
                        maxLength={100}
                        onChange={handleCollectionNameChange}
                        placeholder="z.B. Notfall"
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
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCloseCreateCollection}
                      type="button"
                      variant="outline"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      disabled={createCollectionMutation.isPending}
                      onClick={handleCreateCollection}
                      type="button"
                    >
                      {createCollectionMutation.isPending
                        ? 'Speichern...'
                        : 'Erstellen'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </SidebarGroupContent>
          )}
          <SidebarGroupContent className="relative">
            <form key="search" onSubmit={handleSearchSubmit}>
              <Label className="sr-only" htmlFor="search">
                Suchen
              </Label>
              <SidebarInput
                className="rounded-md bg-muted pl-8 text-sm"
                onChange={handleSearch}
                placeholder="Suchen..."
                ref={searchInputRef}
                type="search"
                value={searchTerm}
              />
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 select-none opacity-50" />
              <Kbd className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 select-none">
                <span suppressHydrationWarning>{isMac ? '⌘K' : 'Ctrl+K'}</span>
              </Kbd>
            </form>
          </SidebarGroupContent>
          {showCreateTemplateButton && (
            <SidebarGroupContent className="relative">
              <Link href="/templates/create">
                <Button className="w-full" variant="default">
                  <PlusCircledIcon className="mr-2 h-4 w-4" />
                  Neuer Textbaustein
                </Button>
              </Link>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      </SidebarHeader>
      <SidebarContent
        className="custom-scrollbar gap-6 text-xl"
        style={{ scrollbarWidth: 'none' }}
      >
        <SidebarGroup>
          <SidebarMenu>
            {orderedSegments.map((segment, index) => (
              <Collapsible
                className="group/collapsible"
                defaultOpen={true}
                key={index}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="font-semibold text-foreground text-lg">
                      {segment.category || 'Diverses'}
                      <Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
                      <Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {segment.documents?.length ? (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {segment.documents.map((item, itemIndex) => (
                          <SidebarMenuSubItem key={itemIndex}>
                            <SidebarMenuSubButton asChild isActive={false}>
                              <Link
                                className="flex items-center justify-between"
                                href={`${item.url}?activeCollection=${encodeURIComponent(activeCollectionValue)}`}
                                onClick={handleCloseMobile}
                              >
                                <span>{item.title}</span>
                                {item.favouritesCount > 0 && (
                                  <span className="ml-2 flex items-center text-muted-foreground text-xs">
                                    <StarIcon className="mr-0.5 h-3 w-3" />
                                    {formatCount(item.favouritesCount)}
                                  </span>
                                )}
                              </Link>
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
