import { database } from '@repo/database';
import { SidebarProvider } from '@repo/design-system/components/ui/sidebar';
import type React from 'react';
import { Suspense } from 'react';

import AppSidebar from './[id]/_components/Sidebar';

//new with prisma
const getTemplatesPrisma = async () => {
  const templates = await database.template.findMany({});
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

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // let templates = getTemplates();
  return (
    <div className="flex h-full w-full">
      <SidebarProvider>
        <Suspense fallback={<AppSidebar key="Sidebar" templates={''} />}>
          <AppSidebar
            key="Sidebar"
            templates={JSON.stringify(await generateSidebarLinks())}
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
