import markdocConfig from '@/markdoc/config';
import Markdoc from '@markdoc/markdoc';

import type { Node } from '@markdoc/markdoc';

import { database } from '@repo/database';

import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import Link from 'next/link';
import ContentSection from './_components/ContentSection';
import { NavActions } from './_components/NavActions';

//new with prisma
const getTemplatesPrisma = async () => {
  const templates = await database.template.findMany({});
  return templates;
};

/*
do not generate static params, because we need to generate them dynamically, if new templates are created
export async function generateStaticParams() {
  const templates = await getTemplatesPrisma();
  // let templates = generateSidebarLinks(getTemplatesPrisma());

  const result = [
    templates.map((template: { id: string }) => {
      return {
        id: template.id,
      };
    }),
  ];
  return result;
}
*/

/*export async function generateMetadata({ params }) {
  const doc = await prisma.template.findUnique({
    where: {
      id: params.id,
    },
  });
  return {
    title: "Scribe - " + doc?.title,
  };
}*/
async function fetchMarkdoc({ id }: { id: string }) {
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
}

function processSwitchStatement(
  node: Node,
  result = { variable: '', options: [] as string[] }
) {
  // If the node has children, process them recursively

  if (node.tag === 'switch') {
    result.variable = node.attributes.primary;
  } else if (node.tag === 'case') {
    result.options.push(node.attributes.primary);
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.tag !== 'switch') {
        processSwitchStatement(child, result);
      }
    }
  }

  return result;
}

const parseTagsToInputs = ({ ast }: { ast: Node }) => {
  const infoTags: string[] = [];
  const switchTags: { variable: any; options: any }[] = [];
  for (const node of ast.walk()) {
    // do something with each node
    // get all info tags (remove duplicates)
    if (
      node.type === 'tag' &&
      node.tag === 'info' &&
      !infoTags.includes(node.attributes.primary)
    ) {
      infoTags.push(node.attributes.primary);
    }
    // get all switch tags, if unique
    if (
      node.type === 'tag' &&
      node.tag === 'switch' &&
      !switchTags.some((tag) => tag.variable === node.attributes.primary) &&
      node.attributes.primary
    ) {
      switchTags.push(processSwitchStatement(node));
    }
  }

  // parse all switch tags
  return { infoTags, switchTags };
};

export default async function NotePage(props: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const params = await props.params;
  const { id } = params;
  const doc = await fetchMarkdoc({ id: id });
  const ast = Markdoc.parse(doc.content);
  const inputTags = parseTagsToInputs({ ast });
  const author =
    (await database.user.findUnique({
      where: {
        id: doc.authorId,
      },
    })) || {};
  const isFavourite = doc?.favouriteOf.some(
    (user: { id: string | undefined }) => user.id === session?.user?.id
  );
  // const frontmatter = parseFrontmatter({ ast });
  const note = Markdoc.transform(ast, markdocConfig);
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-10 items-center justify-between gap-2">
        <Link href={`/templates/${doc?.id}`} className="font-bold">
          {doc?.title}
        </Link>
        <NavActions
          isFavourite={isFavourite}
          isLoggedIn={!!session?.user?.id}
          lastEdited={doc.updatedAt}
          templateId={doc.id}
          favouriteOfCount={doc.favouriteOf?.length}
        />
      </div>
      <ContentSection
        inputTags={JSON.stringify(inputTags)}
        note={JSON.stringify(note)}
      />
    </div>
  );
}
