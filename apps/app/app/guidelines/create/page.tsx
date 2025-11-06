import { auth } from '@/auth';
import { database } from '@repo/database';
import { Button } from '@repo/design-system/components/ui/button';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import createGuideline from '../_actions/create-guideline';
import { generateEmbeddings } from '../_actions/embed-guideline';
import Editor from '../_components/Editor';
export const dynamicParams = false;

type MetadataProps = {
  params: Promise<{ guideline: [category: string, name: string] }>;
};

export function generateMetadata(props: MetadataProps): Metadata {
  return {
    title: 'Scribe - Guideline erstellen',
  };
}

async function fetchMarkdoc({ id }: { id: string }) {
  // fetch the markdoc content for the route
  const doc = await database.guideline.findUnique({
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

export default async function CreateGuideline({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  async function handleSubmit(formData: FormData): Promise<void> {
    'use server';

    const newGuideline = await createGuideline(formData);

    redirect(`/guidelines/${newGuideline.id}`);
  }

  async function handleGenerateEmbedding(formData: FormData): Promise<void> {
    'use server';

    const content = formData.get('content') as string;
    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const { embedding } = await generateEmbeddings(
      content || '',
      title,
      category
    );
    console.log('Generated embedding:', embedding);
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect('/');
  }

  // get the search parameter fork to check, whether an existing guideline should be forked
  const { fork } = await searchParams;

  const forkedGuideline = fork
    ? await fetchMarkdoc({ id: fork as string })
    : null;

  return (
    <div className="flex h-full w-full flex-col">
      <Editor
        cat={forkedGuideline?.category || ''}
        tit={forkedGuideline?.title || ''}
        note={JSON.stringify(forkedGuideline?.content || '')}
        handleSubmitAction={handleSubmit}
        author={session?.user}
      />

      <form action={handleGenerateEmbedding} className="mt-4 self-end">
        <input
          type="hidden"
          name="content"
          value={JSON.stringify(forkedGuideline?.content || '')}
        />
        <Button type="submit" variant="outline">
          Generate Embedding
        </Button>
      </form>
    </div>
  );
}
