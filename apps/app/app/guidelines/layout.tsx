import { database } from '@repo/database';
import { SidebarProvider } from '@repo/design-system/components/ui/sidebar';
import { QueryClient } from '@tanstack/react-query';
import { headers } from 'next/headers';
import type React from 'react';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { orpc } from '@/lib/orpc';
import AppSidebar from './_components/Sidebar';

const getGuidelinesPrisma = async () => {
  const guidelines = await database.guideline.findMany({
    include: {
      _count: {
        select: { favouriteOf: true },
      },
    },
  });
  return guidelines;
};
const getFavouriteGuidelinesPrisma = async (isLoggedIn: boolean) => {
  if (!isLoggedIn) {
    return [];
  }
  try {
    const queryClient = new QueryClient();
    const guidelines = await queryClient.fetchQuery(
      orpc.user.guidelines.favourites.queryOptions()
    );
    return guidelines;
  } catch (error) {
    // If authentication fails, return empty array instead of crashing
    console.warn('Failed to fetch favourite guidelines:', error);
    return [];
  }
};
const getAuthoredGuidelinesPrisma = async (isLoggedIn: boolean) => {
  if (!isLoggedIn) {
    return [];
  }
  try {
    const queryClient = new QueryClient();
    const guidelines = await queryClient.fetchQuery(
      orpc.user.guidelines.authored.queryOptions()
    );
    return guidelines;
  } catch (error) {
    // If authentication fails, return empty array instead of crashing
    console.warn('Failed to fetch authored guidelines:', error);
    return [];
  }
};

const generateSidebarLinks = async () => {
  const guidelines = await getGuidelinesPrisma();
  return guidelines.map((guideline) => ({
    url: `/guidelines/${guideline.id}`,
    category: guideline.category,
    title: guideline.title,
    favouritesCount: guideline._count.favouriteOf,
  }));
};
const generateFavouriteGuidelines = async (isLoggedIn: boolean) => {
  const guidelines = await getFavouriteGuidelinesPrisma(isLoggedIn);
  return guidelines.map((guideline) => ({
    url: `/guidelines/${guideline.id}`,
    category: guideline.category,
    title: guideline.title,
    favouritesCount: guideline._count.favouriteOf,
  }));
};
const generateAuthoredGuidelines = async (isLoggedIn: boolean) => {
  const guidelines = await getAuthoredGuidelinesPrisma(isLoggedIn);
  return guidelines.map((guideline) => ({
    url: `/guidelines/${guideline.id}`,
    category: guideline.category,
    title: guideline.title,
    favouritesCount: guideline._count.favouriteOf,
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
  const isLoggedIn = !!session?.user;
  
  return (
    <div className="flex h-full w-full">
      <SidebarProvider>
        <Suspense
          fallback={
            <AppSidebar
              authoredGuidelines={'[]'}
              favouriteGuidelines={'[]'}
              isLoggedIn={isLoggedIn}
              key="Sidebar"
              guidelines={'[]'}
            />
          }
        >
          <AppSidebar
            authoredGuidelines={JSON.stringify(
              await generateAuthoredGuidelines(isLoggedIn)
            )}
            favouriteGuidelines={JSON.stringify(
              await generateFavouriteGuidelines(isLoggedIn)
            )}
            isLoggedIn={isLoggedIn}
            key="Sidebar"
            guidelines={JSON.stringify(await generateSidebarLinks())}
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
