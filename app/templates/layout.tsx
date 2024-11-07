import { auth } from "@/auth";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import prisma from "@/lib/prisma";
import { Suspense } from "react";
import { NavActions } from "./[id]/_components/NavActions";
import AppSidebar from "./[id]/_components/Sidebar";

//new with prisma
const getTemplatesPrisma = async () => {
  const templates = await prisma.template.findMany({});
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
  const templates = await generateSidebarLinks();
  return (
    <div className="flex h-full w-full">
      <SidebarProvider>
        <Suspense fallback={<AppSidebar key="Sidebar" templates={""} />}>
          <AppSidebar key="Sidebar" templates={JSON.stringify(templates)} />
        </Suspense>
        <main
          key="MainContent"
          className="top-16 h-full flex grow p-4 overscroll-contain"
        >
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
