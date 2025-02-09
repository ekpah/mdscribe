import { database } from '@repo/database';
import { SidebarProvider } from '@repo/design-system/components/ui/sidebar';
import type React from 'react';
import { Suspense } from 'react';

import { auth } from '@repo/auth';
import { headers } from 'next/headers';
import AppSidebar from './_components/Sidebar';

const getTemplatesPrisma = async () => {
  const templates = await database.template.findMany({});
  return templates;
};
const getFavouriteTemplatesPrisma = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const templates = await database.template.findMany({
    where: {
      favouriteOf: {
        some: {
          id: session?.user?.id,
        },
      },
    },
  });
  return templates;
};

const generateSidebarLinks = async () => {
  const templates = await getTemplatesPrisma();
  return templates.map((temp) => ({
    url: `/templates/${temp.id}`,
    category: temp.category,
    title: temp.title,
  }));
};
const generateFavouriteTemplates = async () => {
  const templates = await getFavouriteTemplatesPrisma();
  return templates.map((temp) => ({
    url: `/templates/${temp.id}`,
    category: temp.category,
    title: temp.title,
  }));
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // let templates = getTemplates();
  return (
    <div className="flex h-full w-full">
      <SidebarProvider>
        <Suspense
          fallback={
            <AppSidebar key="Sidebar" templates={''} favouriteTemplates={''} />
          }
        >
          <AppSidebar
            key="Sidebar"
            templates={JSON.stringify(await generateSidebarLinks())}
            favouriteTemplates={JSON.stringify(
              await generateFavouriteTemplates()
            )}
          />
        </Suspense>

        <main
          key="MainContent"
          className="top-16 flex h-full grow overscroll-contain p-4"
        >
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
