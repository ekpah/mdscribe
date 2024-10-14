import markdocConfig from "@/markdoc/config";
import Markdoc from "@markdoc/markdoc";
import { globSync } from "glob";
import type { Metadata } from "next";
import fs from "node:fs";

// load the correct markdown from file
import yaml from "js-yaml";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import config from "@/markdoc/config";
import { Prisma } from "@prisma/client";
import ContentSection from "./_components/ContentSection";

export const dynamicParams = false;

export async function generateStaticParams() {
  let templates = await getTemplatesPrisma();
  // let templates = generateSidebarLinks(getTemplatesPrisma());

  return templates.map((template) => ({
    id: template.id,
  }));
}

//new with prisma
const getTemplatesPrisma = async () => {
  const templates = await prisma.template.findMany({});
  return templates;
};

export async function generateMetadata({ params }) {
  const doc = await prisma.template.findUnique({
    where: {
      id: params.id,
    },
  });
  return {
    title: "Scribe - " + doc?.title,
  };
}
async function fetchMarkdoc({ id }) {
  // fetch the markdoc content for the route
  const session = await auth();
  const doc = await prisma.template.findUnique({
    where: {
      id: id,
    },
  });
  if (!doc) throw new Error("Not found");

  const ast = Markdoc.parse(doc.content);

  return ast;
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

export default async function NotePage({ params }) {
  const { id } = params;
  const ast = await fetchMarkdoc({ id });
  const inputTags = parseTagsToInputs({ ast });
  const frontmatter = parseFrontmatter({ ast });
  const inputs = frontmatter.inputs;
  const note = renderMarkdoc(ast, markdocConfig);
  return (
    <ContentSection
      inputs={JSON.stringify(inputs)}
      inputTags={JSON.stringify(inputTags)}
      note={JSON.stringify(note)}
    />
  );
}
