import type { Metadata } from "next";

// load the correct markdown from file

import { auth } from "@/auth";
import { Skeleton } from "@/components/ui/skeleton";
import prisma from "@/lib/prisma";
import Markdoc from "@markdoc/markdoc";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NavActions } from "../_components/NavActions";
import Editor from "./_components/Editor";
import SkeletonEditor from "./_components/SkeletonEditor";

export const dynamicParams = false;

async function fetchMarkdoc({ id }) {
  // fetch the markdoc content for the route
  const doc = await prisma.template.findUnique({
    where: {
      id: id,
    },
    include: {
      author: true, // All posts where authorId == 20
      favouriteOf: true,
    },
  });
  if (!doc) throw new Error("Not found");

  return doc;
}

export async function generateMetadata(props): Promise<Metadata> {
  const params = await props.params;
  const { template } = params;
  const [category, name] = template ? template : [undefined, "Scribe"];
  return {
    title: "Scribe - " + name,
  };
}

export default async function EditTemplate(props) {
  const params = await props.params;
  const session = await auth();
  /*if (!session?.user) {
    redirect("/");
  }*/
  const { id } = params;
  const doc = await fetchMarkdoc({ id });
  const author = await prisma.user.findUnique({
    where: {
      id: doc.authorId,
    },
  });
  if (!author) throw new Error("Author not found");
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-10 items-center gap-2 justify-between">
        <Link href={`/templates/${doc?.id}`} className="font-bold">
          {doc?.title}
        </Link>
        <NavActions author={author} template={doc} />
      </div>
      <Editor
        cat={doc.category}
        tit={doc.title}
        note={JSON.stringify(doc.content)}
        id={id}
        authorId={doc.authorId}
      />
    </div>
  );
}
