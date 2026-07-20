'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  NavigationSidebar,
} from '@/app/_components/sidebar/navigation-sidebar';
import type {
  NavigationSidebarItem,
  NavigationSidebarSection,
} from '@/app/_components/sidebar/navigation-sidebar';
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from '@repo/design-system/components/ui/sidebar';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import {
  Bookmark,
  Folder,
  FolderPlus,
  Plus,
  Pencil,
  PlusCircle,
  Search,
  StarIcon,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
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

const FavouriteCollectionIcon = (props: LucideProps) => (
  <Bookmark {...props} strokeWidth={1.5} />
);

const AuthoredCollectionIcon = (props: LucideProps) => (
  <Pencil {...props} strokeWidth={1.5} />
);

const generateSegments = ({ templates }: { templates: Template[] }) => {
  const segments: SidebarSegment[] = [];

  for (const current of templates) {
    const { category } = current;
    const template = current.title;
    const route = current.url;
    const { favouritesCount } = current;
    const existingCategory = segments.find(
      (segment) => segment.category === category
    );
    if (existingCategory) {
      existingCategory.documents.push({
        favouritesCount,
        title: template,
        url: route,
      });
    } else {
      segments.push({
        category,
        documents: [{ favouritesCount, title: template, url: route }],
      });
    }
  }

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
    { defaultValue: isLoggedIn ? 'favourites' : 'visible' }
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

  const { data: customCollectionsQueryData } = useQuery({
    ...orpc.user.collections.list.queryOptions(),
    enabled: isLoggedIn,
  });
  const customCollectionsData =
    customCollectionsQueryData ?? initialCustomCollections;

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
    description: '',
    name: '',
  });

  const createCollectionMutation = useMutation(
    orpc.user.collections.create.mutationOptions({
      onSuccess: (collection) => {
        queryClient.invalidateQueries({
          queryKey: orpc.user.collections.list.queryOptions().queryKey,
        });
        setCollectionForm({ description: '', name: '' });
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

  const userCollections = isLoggedIn
    ? [
        {
          key: 'favourites',
          logo: FavouriteCollectionIcon,
          name: 'Favoriten',
        },
        {
          key: 'authored',
          logo: AuthoredCollectionIcon,
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
    ? [...userCollections, ...customCollectionEntries]
    : [];

  const fallbackCollection = isLoggedIn ? 'favourites' : 'visible';
  const activeCollectionValue = collections.some(
    (collection) => collection.key === activeCollection
  )
    ? activeCollection
    : fallbackCollection;

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
    setCollectionForm({ description: '', name: '' });
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
      setCollectionForm({ description: '', name: '' });
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

  const menuSegments = (() => {
    if (activeCollectionValue === 'favourites') {
      return initialFavouriteTemplates;
    }
    if (activeCollectionValue === 'authored') {
      return initialAuthoredTemplates;
    }
    if (activeCollectionValue === 'visible') {
      return initialTemplates;
    }
    return activeCustomCollection?.templates ?? [];
  })();

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

  const navigationSections = useMemo<NavigationSidebarSection[]>(
    () =>
      orderedSegments.map((segment) => ({
        items: segment.documents.map((item) => ({
          count: item.favouritesCount,
          href: item.url,
          title: item.title,
        })),
        key: segment.category || 'uncategorized',
        title: segment.category,
      })),
    [orderedSegments]
  );

  const getTemplateItemHref = useCallback(
    (item: NavigationSidebarItem) =>
      `${item.href}?activeCollection=${encodeURIComponent(activeCollectionValue)}`,
    [activeCollectionValue]
  );

  const renderTemplateItemMeta = useCallback((item: NavigationSidebarItem) => {
    if (!item.count || item.count <= 0) {
      return null;
    }

    return (
      <span className="ml-2 flex items-center text-muted-foreground text-xs">
        <StarIcon className="mr-0.5 h-3 w-3" />
        {formatCount(item.count)}
      </span>
    );
  }, []);

  return (
    <NavigationSidebar
      className="top-16 mb-16 p-1 pb-20"
      contentClassName="custom-scrollbar gap-6 text-xl"
      expandIcon="plus-minus"
      getItemHref={getTemplateItemHref}
      header={
        <>
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
                <DialogTrigger render={<Button
                    className="w-full justify-start gap-2 px-2"
                    type="button"
                    variant="outline"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>Neue Sammlung</span>
                  </Button>} />
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
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Neuer Textbaustein
                </Button>
              </Link>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
        </>
      }
      renderItemMeta={renderTemplateItemMeta}
      sectionButtonClassName="font-semibold text-foreground text-lg"
      sections={navigationSections}
    />
  );
}
