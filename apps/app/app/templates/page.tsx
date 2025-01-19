import { database } from '@repo/database';
import Link from 'next/link';
import ContentSection from './[id]/_components/ContentSection';
import { NavActions } from './[id]/_components/NavActions';

export default async function TemplatesPage() {
  const templates = await database.template.findMany({
    include: {
      author: true,
      favouriteOf: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <Link href={'/templates'} className="font-bold">
          Templates
        </Link>
        <NavActions
          author={''}
          isFavourite={false}
          isLoggedIn={false}
          lastEdited={new Date()}
          templateId={''}
          favouriteOfCount={0}
        />
      </div>
      <ContentSection
        inputTags={JSON.stringify([])}
        note={JSON.stringify('')}
      />
    </div>
  );
}
