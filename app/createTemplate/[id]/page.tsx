import { globSync } from "glob";
import type { Metadata } from "next";
import fs from "node:fs";
// load the correct markdown from file

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Markdoc from "@markdoc/markdoc";
import Editor from "../_components/Editor";

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
async function fetchMarkdoc({ id }) {
  // fetch the markdoc content for the route
  const session = await auth();
  const doc = await prisma.template.findUnique({
    where: {
      id: id,
    },
  });
  if (!doc) throw new Error("Not found");

  return doc;
}

export function generateMetadata({ params }): Metadata {
  const { template } = params;
  const [category, name] = template ? template : [undefined, "Scribe"];
  return {
    title: "Scribe - " + name,
  };
}

export default async function CreateTemplate({ params }) {
  const { id } = params;
  const doc = await fetchMarkdoc({ id });

  return (
    <Editor
      cat={doc.category}
      tit={doc.title}
      note={JSON.stringify(doc.content)}
    />
  );
}
