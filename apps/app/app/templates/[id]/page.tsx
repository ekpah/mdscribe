import { database } from '@repo/database';

import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@repo/design-system/components/ui/breadcrumb';
import { SidebarTrigger } from '@repo/design-system/components/ui/sidebar';
import parseMarkdocToInputs from '@repo/markdoc-md/parse/parseMarkdocToInputs';
import { unstable_cache } from 'next/cache';
import { headers } from 'next/headers';
import Link from 'next/link';
import ContentSection from './_components/ContentSection';
import { NavActions } from './_components/NavActions';

const fetchMarkdoc = unstable_cache(async ({ id }: { id: string }) => {
  // fetch the markdoc content for the route
  const doc = await database.template.findUnique({
    where: {
      id: id,
    },
    include: {
      favouriteOf: true,
      author: true,
    },
  });
  if (!doc) {
    throw new Error('Document not found');
  }
  return doc;
});

export default async function NotePage(props: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const params = await props.params;
  const { id } = params;
  const doc = await fetchMarkdoc({ id: id });

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
          isFavourite={isFavourite}
          isLoggedIn={!!session?.user?.id}
          lastEdited={doc.updatedAt}
          templateId={doc.id}
          favouriteOfCount={doc.favouriteOf?.length}
          author={author?.email}
        />
      </div>
      <ContentSection
        inputTags={JSON.stringify(inputTags)}
        note={doc.content}
      />
    </div>
  );
}
