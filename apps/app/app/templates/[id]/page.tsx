
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/design-system/components/ui/breadcrumb';
import { SidebarTrigger } from '@repo/design-system/components/ui/sidebar';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
import { orpc } from '@/lib/orpc';
import ContentSection from './_components/ContentSection';
import { NavActions } from './_components/NavActions';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const { id } = params;
  const queryClient = new QueryClient();
  const doc = await queryClient.fetchQuery(
    orpc.templates.get.queryOptions({ input: { id } })
  );

  return {
    title: doc?.title,
  };
}

export default async function NotePage(props: PageProps) {
  const queryClient = new QueryClient();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const params = await props.params;
  const { id } = params;
  const doc = await queryClient.fetchQuery(
    orpc.templates.get.queryOptions({ input: { id } })
  );
  if (!doc) {
    throw new Error('Document not found');
  }

  const inputTags = parseMarkdocToInputs(doc.content);
  const author = doc.author || { email: 'Anonym' };
  const isFavourite = doc?.favouriteOf.some(
    (user: { id: string | undefined }) => user.id === session?.user?.id
  );

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <SidebarTrigger className="ml-4 block md:hidden" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <Link href={'/templates'}>Textbausteine</Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{doc?.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NavActions
          author={author?.email}
          favouriteOfCount={doc.favouriteOf?.length}
          isFavourite={isFavourite}
          isLoggedIn={!!session?.user?.id}
          lastEdited={doc.updatedAt}
          templateId={doc.id}
        />
      </div>
      <ContentSection
        inputTags={JSON.stringify(inputTags)}
        note={doc.content}
      />
    </div>
  );
}
