import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { globSync } from "glob";
import Sidebar from "./[id]/_components/Sidebar";

//new with prisma
const getTemplatesPrisma = async () => {
  const session = await auth();
  const templates = await prisma.template.findMany({
    where: {
      authorId: session?.user?.id as any,
    },
  });
  return templates;
};

const generateSidebarLinks = (templates) => {
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
  const prismaTemplates = await getTemplatesPrisma();
  let templates = generateSidebarLinks(prismaTemplates);
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] w-full">
      <aside
        key="Sidebar"
        className="sticky top-16 flex h-full w-40 flex-col items-start justify-start overscroll-none border-r transition md:w-60"
      >
        <Sidebar templates={JSON.stringify(templates)} />
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
