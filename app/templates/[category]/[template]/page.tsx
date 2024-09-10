import markdocConfig from "@/markdoc/config";
import Markdoc from "@markdoc/markdoc";
import { globSync } from "glob";
import type { Metadata } from "next";
import fs from "node:fs";

import Sidebar from "./_components/Sidebar";
// load the correct markdown from file
import yaml from "js-yaml";

import ContentSection from "./_components/ContentSection";

export const dynamicParams = false;

const getTemplates = () => {
  const res = globSync("./templates/**/*.md");
  const templates = res.map((temp) => ({
    route: temp,
    category: temp.split("/")[1],
    template: temp.split("/")[2].replace(".md", ""),
  }));
  return templates;
};

export async function generateStaticParams() {
  let templates = getTemplates();

  return templates.map((template) => ({
    category: template.category,
    template: template.template,
  }));
}
export function generateMetadata({ params }): Metadata {
  const { category, template } = params;
  return {
    title: "Scribe - " + template,
  };
}
const fetchMarkdoc = ({ category, template }) => {
  // fetch the markdoc content for the route
  const doc = fs.readFileSync(`templates/${category}/${template}.md`, "utf8");
  const ast = Markdoc.parse(doc);
  return ast;
};

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

export default function NotePage({ params }) {
  const { category, template } = params;
  const ast = fetchMarkdoc({ category, template });
  const inputTags = parseTagsToInputs({ ast });
  const frontmatter = parseFrontmatter({ ast });
  const inputs = frontmatter.inputs;
  let templates = getTemplates();
  const note = renderMarkdoc(ast, markdocConfig);
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] w-full">
      <aside
        key="Sidebar"
        className="sticky top-16 flex h-full w-40 flex-col items-start justify-start overscroll-none border-r transition md:w-60"
      >
        <Sidebar segments={JSON.stringify(templates)} />
      </aside>
      <main
        key="MainContent"
        className="w-[calc(100vw-theme(spacing.60))] flex-1 overflow-y-auto overscroll-none"
      >
        <ContentSection
          inputs={JSON.stringify(inputs)}
          inputTags={JSON.stringify(inputTags)}
          note={JSON.stringify(note)}
        />
      </main>
    </div>
  );
}
