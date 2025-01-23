import type { Metadata } from 'next';

// load the correct markdown from file

import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
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

export default async function CreateTemplate(props: PageProps) {
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

  return (
    <div className="flex h-full w-full flex-col">
      <Editor cat={''} tit={''} note={''} handleSubmitAction={handleSubmit} />
    </div>
  );
}
