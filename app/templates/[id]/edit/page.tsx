import type { Metadata } from "next";

// load the correct markdown from file

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import Markdoc from "@markdoc/markdoc";
import { redirect } from "next/navigation";
import Editor from "./_components/Editor";

export const dynamicParams = false;

async function fetchMarkdoc({ id }) {
  // fetch the markdoc content for the route
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

export default async function EditTemplate({ params }) {
  const session = await auth();
  /*if (!session?.user) {
    redirect("/");
  }*/
  const { id } = params;
  const doc = await fetchMarkdoc({ id });

  return (
    <Editor
      cat={doc.category}
      tit={doc.title}
      note={JSON.stringify(doc.content)}
      id={id}
      authorId={doc.authorId}
    />
  );
}
