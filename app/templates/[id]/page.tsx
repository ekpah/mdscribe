import markdocConfig from "@/markdoc/config";
import Markdoc from "@markdoc/markdoc";

// load the correct markdown from file
import yaml from "js-yaml";

import prisma from "@/lib/prisma";

import Link from "next/link";
import ContentSection from "./_components/ContentSection";
import { NavActions } from "./_components/NavActions";

export const dynamicParams = false;

export async function generateStaticParams() {
  let templates = await getTemplatesPrisma();
  // let templates = generateSidebarLinks(getTemplatesPrisma());

  const result = templates.map((template) => {
    return {
      id: template.id,
    };
  });
  return result;
}

//new with prisma
const getTemplatesPrisma = async () => {
  const templates = await prisma.template.findMany({});
  return templates;
};

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
async function fetchMarkdoc({ id }) {
  // fetch the markdoc content for the route
  // const session = await auth();
  const doc = await prisma.template.findUnique({
    where: {
      id: id,
    },
  });
  if (!doc) throw new Error("Not found");

  return doc;
}

const parseFrontmatter = ({ ast }) => {
  // fetch the markdoc content for the route
  const frontmatter = ast.attributes.frontmatter
    ? yaml.load(ast.attributes.frontmatter)
    : {};
  return frontmatter;
};

const renderMarkdoc = (ast, markdocConfig) => {
  const content = Markdoc.transform(ast, markdocConfig);
  return content;
};

function processSwitchStatement(
  node,
  result = { variable: "", options: [] as string[] }
) {
  // If the node has children, process them recursively

  if (node.tag === "switch") {
    result.variable = node.attributes.primary;
  } else if (node.tag === "case") {
    result.options.push(node.attributes.primary);
  }

  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      if (child.tag !== "switch") {
        processSwitchStatement(child, result);
      }
    });
  }

  return result;
}

const parseTagsToInputs = ({ ast }) => {
  let infoTags: string[] = [];
  let switchTags: { variable: any; options: any }[] = [];
  for (const node of ast.walk()) {
    // do something with each node
    // get all info tags (remove duplicates)
    if (
      node.type === "tag" &&
      node.tag === "info" &&
      !infoTags.includes(node.attributes.primary)
    ) {
      infoTags.push(node.attributes.primary);
    }
    // get all switch tags, if unique
    if (
      node.type === "tag" &&
      node.tag === "switch" &&
      !switchTags.some((tag) => tag.variable == node.attributes.primary) &&
      node.attributes.primary
    ) {
      switchTags.push(processSwitchStatement(node));
    }
  }

  // parse all switch tags
  return { infoTags, switchTags };
};

export default async function NotePage(props) {
  const params = await props.params;
  const { id } = params;
  const doc = await fetchMarkdoc({ id: id });
  const ast = Markdoc.parse(doc.content);
  const inputTags = parseTagsToInputs({ ast });
  const author = await prisma.user.findUnique({
    where: {
      id: doc.authorId,
    },
  });
  if (!author) throw new Error("Author not found");
  // const frontmatter = parseFrontmatter({ ast });
  const note = renderMarkdoc(ast, markdocConfig);
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-10 items-center gap-2 justify-between">
        <Link href={`/templates/${doc?.id}`} className="font-bold">
          {doc?.title}
        </Link>
        <NavActions template={doc} author={author} />
      </div>
      <ContentSection
        template={doc}
        inputTags={JSON.stringify(inputTags)}
        note={JSON.stringify(note)}
      />
    </div>
  );
}
