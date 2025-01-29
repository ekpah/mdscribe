import markdocConfig from '@/markdoc/config';
import Markdoc from '@markdoc/markdoc';

import type { Node } from '@markdoc/markdoc';

import { database } from '@repo/database';

import type { PageProps } from '@/.next/types/app/page';
import { auth } from '@/auth';
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

function processSwitchChildren(
  node: Node,
  result: CaseTagType[] = []
): CaseTagType[] {
  // If the node has children, process them recursively
  if (node.tag === 'case') {
    result.push({
      type: 'case',
      options: { name: node.attributes.primary },
    });
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.tag !== 'switch') {
        processSwitchChildren(child, result);
      }
    }
  }

  return result;
}

type InputTagType = {
  type: 'info' | 'switch';
  options: { name: string };
  children?: CaseTagType[];
};

type InfoTagType = {
  type: 'info';
  options: { name: string };
};

type SwitchTagType = {
  type: 'switch';
  options: { name: string };
  children: CaseTagType[];
};

type CaseTagType = {
  type: 'case';
  options: { name: string };
};

const parseTagsToInputs = ({ ast }: { ast: Node }) => {
  // all tags in the order they appear in the document
  const inputTags: (InfoTagType | SwitchTagType | CaseTagType)[] = [];
  // all info tags (remove duplicates)
  const infoTags: string[] = [];
  // all switch tags (remove duplicates)
  const switchTags: { variable: string; options: string[] }[] = [];
  for (const node of ast.walk()) {
    // do something with each node
    // get all info tags (remove duplicates)
    if (
      node.type === 'tag' &&
      node.tag === 'info' &&
      !infoTags.includes(node.attributes.primary)
    ) {
      inputTags.push({
        type: 'info',
        options: { name: node.attributes.primary },
      });
      infoTags.push(node.attributes.primary);
    }
    // get all switch tags, if unique
    if (
      node.type === 'tag' &&
      node.tag === 'switch' &&
      !switchTags.some((tag) => tag.variable === node.attributes.primary) &&
      node.attributes.primary
    ) {
      inputTags.push({
        type: 'switch',
        options: { name: node.attributes.primary },
        children: processSwitchChildren(node),
      });
      switchTags.push(processSwitchStatement(node));
    }
  }

  // parse all switch tags
  return { infoTags, switchTags, inputTags };
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
  const author = doc.author || { email: 'Anonym' };
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
          author={author?.email}
        />
      </div>
      <ContentSection
        inputTags={JSON.stringify(inputTags)}
        note={JSON.stringify(note)}
      />
    </div>
  );
}
