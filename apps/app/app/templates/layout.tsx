import { database } from '@repo/database';
import { SidebarProvider } from '@repo/design-system/components/ui/sidebar';
import { QueryClient } from '@tanstack/react-query';
import { headers } from 'next/headers';
import type React from 'react';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { orpc } from '@/lib/orpc';
import AppSidebar from './_components/Sidebar';

const getTemplatesPrisma = async () => {
  const templates = await database.template.findMany({
    include: {
      _count: {
        select: { favouriteOf: true },
      },
    },
  });
  return templates;
};
const getFavouriteTemplatesPrisma = async () => {
  const queryClient = new QueryClient();
  const templates = await queryClient.fetchQuery(
    orpc.user.templates.favourites.queryOptions()
  );
  return templates;
};
const getAuthoredTemplatesPrisma = async () => {
  const queryClient = new QueryClient();
  const templates = await queryClient.fetchQuery(
    orpc.user.templates.authored.queryOptions()
  );
  return templates;
};

const generateSidebarLinks = async () => {
  const templates = await getTemplatesPrisma();
  return templates.map((temp) => ({
    url: `/templates/${temp.id}`,
    category: temp.category,
    title: temp.title,
    favouritesCount: temp._count.favouriteOf,
  }));
};
const generateFavouriteTemplates = async () => {
  const templates = await getFavouriteTemplatesPrisma();
  return templates.map((temp) => ({
    url: `/templates/${temp.id}`,
    category: temp.category,
    title: temp.title,
    favouritesCount: temp._count.favouriteOf,
  }));
};
const generateAuthoredTemplates = async () => {
  const templates = await getAuthoredTemplatesPrisma();
  return templates.map((temp) => ({
    url: `/templates/${temp.id}`,
    category: temp.category,
    title: temp.title,
    favouritesCount: temp._count.favouriteOf,
  }));
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const _isLoggedIn = !!session?.user;
  // let_isLoggedIn = getTemplates();
  return (
    <div className="flex h-full w-full">
      <SidebarProvider>
        <Suspense
          fallback={
            <AppSidebar
              authoredTemplates={''}
              favouriteTemplates={''}
              isLoggedIn
              key="Sidebar"
              templates={''}
            />
          }
        >
          <AppSidebar
            authoredTemplates={JSON.stringify(
              await generateAuthoredTemplates()
            )}
            favouriteTemplates={JSON.stringify(
              await generateFavouriteTemplates()
            )}
            isLoggedIn
            key="Sidebar"
            templates={JSON.stringify(await generateSidebarLinks())}
          />
        </Suspense>
        <main
          className="top-16 flex h-full grow overscroll-contain p-4"
          key="MainContent"
        >
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
