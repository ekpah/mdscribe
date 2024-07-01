import markdocConfig from "@/markdoc/config";
import Markdoc from "@markdoc/markdoc";
import { globSync } from "glob";
import { uniq } from "lodash";
import type { Metadata } from "next";
import fs from "node:fs";
import Inputs from "./_components/Inputs";
import Note from "./_components/Note";
import Sidebar from "./_components/Sidebar";
// load the correct markdown from file
import yaml from "js-yaml";

export const dynamicParams = false;
/*const segments = [
  {
    category: "Gastroenterologie",
    documents: ["Colitis-Ulcerosa", "Alkoholentzug", "Leberzirrhose"],
  },
  {
    category: "Kardiologie",
    documents: [
      "STEMI",
      "TAVI",
      "TAVI-Vorbereitung",
      "Schrittmacher",
      "Schrittmacher-Aggregat-Wechsel",
      "PTSMA",
      "PVI",
      "PFO-Verschluss",
      "PCI",
      "Mitraclip",
      "Kardioversion",
      "Kardiale-Dekompensation",
      "Ausschluss-KHK",
    ],
  },
];*/

const getTemplates = () => {
  const res = globSync("./templates/**/*.md");
  const templates = res.map((temp) => ({
    route: temp,
    category: temp.split("/")[1],
    template: temp.split("/")[2].replace(".md", ""),
  }));
  return templates;
};

const generateSegments = (templates) => {
  const segments = templates.reduce((acc, current) => {
    const category = current.category;
    const template = current.template;

    const existingCategory = acc.find(
      (segment) => segment.category === category
    );
    if (existingCategory) {
      existingCategory.documents.push(template);
    } else {
      acc.push({ category, documents: [template] });
    }

    return acc;
  }, []);

  return segments;
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

export default function NotePage({ params }) {
  const { category, template } = params;
  const ast = fetchMarkdoc({ category, template });

  const frontmatter = parseFrontmatter({ ast });
  const inputs = frontmatter.inputs;
  let templates = getTemplates();
  let segments = generateSegments(templates);

  const note = renderMarkdoc(ast, markdocConfig);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] w-full">
      <aside
        key="Sidebar"
        className="sticky top-16 flex h-full w-40 flex-col items-start justify-start overscroll-none border-r transition md:w-60"
      >
        <Sidebar
          segments={JSON.stringify(segments)}
          category={category}
          template={template}
        />
      </aside>
      <main
        key="MainContent"
        className="w-[calc(100vw-theme(spacing.60))] flex-1 overflow-y-auto overscroll-none"
      >
        <div className="flex h-full w-full justify-items-stretch">
          <div className="h-full w-1/2 overflow-y-auto p-4 prose prose-slate">
            <Inputs inputs={inputs} />
          </div>
          <Note note={JSON.stringify(note)} />
        </div>
      </main>
    </div>
  );
}
