import type { Metadata } from 'next';

// load the correct markdown from file

import { database } from '@repo/database';
import { uniqueId } from 'lodash';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
import editGuideline from '../../_actions/edit-guideline';
import Editor from '../../_components/Editor';
export const dynamicParams = false;

async function fetchMarkdoc({ id }: { id: string }) {
  // fetch the markdoc content for the route
  const doc = await database.guideline.findUnique({
    where: {
      id,
    },
    include: {
      author: true, // All posts where authorId == 20
      favouriteOf: true,
    },
  });
  return doc;
}
type MetadataProps = {
  params: Promise<{ guideline: [category: string, name: string] }>;
};

export async function generateMetadata(
  props: MetadataProps
): Promise<Metadata> {
  const params = await props.params;
  const { guideline } = params;
  const [_category, name] = guideline ? guideline : [undefined, 'Scribe'];
  return {
    title: `Scribe - ${name}`,
  };
}

export default async function EditGuideline(props: PageProps) {
  async function handleSubmit(formData: FormData): Promise<void> {
    'use server';

    const newGuideline = await editGuideline(formData);

    redirect(`/guidelines/${newGuideline.id}`);
  }

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
  const isNewGuideline = !doc;
  const author = await database.user.findUnique({
    where: {
      id: doc ? doc.authorId : session?.user?.id,
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
        handleSubmitAction={handleSubmit}
        id={isNewGuideline ? uniqueId() : id}
        note={JSON.stringify(doc?.content || '')}
        tit={doc?.title || ''}
      />
    </div>
  );
}
