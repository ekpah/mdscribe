import { auth } from '@/auth';
import { database } from '@repo/database';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import createTemplate from '../_actions/create-template';
import Editor from '../_components/Editor';
export const dynamicParams = false;

type MetadataProps = {
  params: Promise<{ template: [category: string, name: string] }>;
};

export function generateMetadata(props: MetadataProps): Metadata {
  return {
    title: 'Scribe - Template erstellen',
  };
}

async function fetchMarkdoc({ id }: { id: string }) {
  // fetch the markdoc content for the route
  const doc = await database.template.findUnique({
    where: {
      id: id,
    },
    include: {
      author: true, // All posts where authorId == 20
      favouriteOf: true,
    },
  });
  return doc;
}

export default async function CreateTemplate({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  async function handleSubmit(formData: FormData): Promise<void> {
    'use server';

    const newTemplate = await createTemplate(formData);

    redirect(`/templates/${newTemplate.id}`);
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect('/');
  }

  // get the search parameter fork to check, whether an existing template should be forked
  const { fork } = await searchParams;

  const forkedTemplate = fork
    ? await fetchMarkdoc({ id: fork as string })
    : null;

  return (
    <div className="flex h-full w-full flex-col">
      <Editor
        cat={forkedTemplate?.category || ''}
        tit={forkedTemplate?.title || ''}
        note={JSON.stringify(forkedTemplate?.content || '')}
        handleSubmitAction={handleSubmit}
        author={session?.user}
      />
    </div>
  );
}
