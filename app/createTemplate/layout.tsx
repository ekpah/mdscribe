import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { globSync } from "glob";
import Sidebar from "./_components/Sidebar";

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

const getTemplates = () => {
  const res = globSync("./templates/**/*.md");
  const templates = res.map((temp) => ({
    route: temp,
    category: temp.split("/")[1],
    template: temp.split("/")[2].replace(".md", ""),
  }));
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
  const prismaTemplates = await getTemplatesPrisma();
  const templates = generateSidebarLinks(prismaTemplates);
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
        className="w-[calc(100vw-theme(spacing.60))] flex overflow-y-auto items-center justify-center overscroll-none"
      >
        {children}
      </main>
    </div>
  );
}
