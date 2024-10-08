import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import markdocConfig from "@/markdoc/config";
import Markdoc from "@markdoc/markdoc";
import { globSync } from "glob";
import type { Metadata } from "next";
import fs from "node:fs";

// load the correct markdown from file
import yaml from "js-yaml";

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
  const templateArray = templates.map((template) => ({
    template: [template.category, template.template],
  }));
  templateArray.push({ template: undefined });
  return templateArray;
}
export function generateMetadata({ params }): Metadata {
  const { template } = params;
  const [category, name] = template ? template : [undefined, "Scribe"];
  return {
    title: "Scribe - " + name,
  };
}
const fetchMarkdoc = ({ category, name }) => {
  // fetch the markdoc content for the route
  const doc = fs.readFileSync(`templates/${category}/${name}.md`, "utf8");
  return doc;
};

import Tiptap from "../_components/TipTap";
export default async function Editor({ params }) {
  const { template } = params;

  const [category, name] = template ? template : [undefined, undefined];
  const note = template ? fetchMarkdoc({ category, name }) : "";

  return (
    <Card className="w-2/3 h-2/3 flex flex-col items-center justify-center">
      <Input
        className="border-secondary"
        placeholder="Kategorie"
        defaultValue={category}
      />
      {/*<Card className="border-secondary m-4">
        <Tiptap note={JSON.stringify(note)} />
      </Card>*/}
      <Textarea defaultValue={note} className="h-2/3" />
      <div className="flex flex-row p-2">
        <Button variant="secondary" className="m-4">
          Abbrechen
        </Button>
        <Button className="m-4">Speichern</Button>
      </div>
    </Card>
  );
}
