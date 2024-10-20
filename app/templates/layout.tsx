import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Suspense } from "react";
import Sidebar from "./[id]/_components/Sidebar";

//new with prisma
const getTemplatesPrisma = async () => {
  const templates = await prisma.template.findMany({});
  return templates;
};

const generateSidebarLinks = async () => {
  const templates = await getTemplatesPrisma();
  return templates.map((temp) => ({
    route: `/${temp.id}`,
    category: temp.category,
    template: temp.title,
  }));
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // let templates = getTemplates();
  const templates = await generateSidebarLinks();
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] w-full">
      <aside
        key="Sidebar"
        className="sticky top-16 flex h-full w-40 flex-col items-start justify-start overscroll-none border-r transition md:w-60"
      >
        <Suspense fallback={<Sidebar templates={[""]} />}>
          <Sidebar templates={JSON.stringify(templates)} />
        </Suspense>
      </aside>
      <main
        key="MainContent"
        className="w-[calc(100vw-theme(spacing.60))] flex-1 overflow-y-auto overscroll-none"
      >
        {children}
      </main>
    </div>
  );
}
