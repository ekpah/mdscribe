import type { Metadata } from 'next';

// load the correct markdown from file

import { database } from '@repo/database';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
import Editor from '../../_components/Editor';
export const dynamicParams = false;

async function fetchMarkdoc({ id }: { id: string }) {
  // fetch the markdoc content for the route
  const doc = await database.template.findUnique({
    where: {
      id,
    },
    include: {
      author: true,
      favouriteOf: true,
    },
  });
  return doc;
}
type MetadataProps = {
  params: Promise<{ template: [category: string, name: string] }>;
};

export async function generateMetadata(
  props: MetadataProps
): Promise<Metadata> {
  const params = await props.params;
  const { template } = params;
  const [_category, name] = template ? template : [undefined, 'Scribe'];
  return {
    title: `Scribe - ${name}`,
  };
}

export default async function EditTemplate(props: PageProps) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect('/');
  }
  const { id } = params;
  const doc = await fetchMarkdoc({ id });
  if (!doc) {
    throw new Error('Document not found');
  }
  const author = await database.user.findUnique({
    where: {
      id: doc.authorId,
    },
  });
  if (!author) {
    throw new Error('Author not found');
  }
  return (
    <div className="flex h-full w-full flex-col">
      <Editor
        author={author}
        cat={doc?.category || ''}
        id={id}
        note={JSON.stringify(doc?.content || '')}
        tit={doc?.title || ''}
      />
    </div>
  );
}
