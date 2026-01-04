import { database, eq, template, user } from "@repo/database";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Editor from "../../_components/Editor";

export const dynamicParams = false;

async function fetchMarkdoc({ id }: { id: string }) {
	const [doc] = await database.select().from(template).where(eq(template.id, id)).limit(1);
	return doc;
}

type MetadataProps = {
	params: Promise<{ template: [category: string, name: string] }>;
};

export async function generateMetadata(
	props: MetadataProps,
): Promise<Metadata> {
	const params = await props.params;
	const { template: templateParam } = params;
	const [_category, name] = templateParam ? templateParam : [undefined, "Scribe"];
	return {
		title: `Scribe - ${name}`,
	};
}

export default async function EditTemplate(
	props: PageProps<"/templates/[id]/edit">,
) {
	const params = await props.params;
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session?.user) {
		redirect("/");
	}
	const { id } = params;
	const doc = await fetchMarkdoc({ id });
	if (!doc) {
		throw new Error("Document not found");
	}

	const [author] = await database
		.select()
		.from(user)
		.where(eq(user.id, doc.authorId))
		.limit(1);

	if (!author) {
		throw new Error("Author not found");
	}
	return (
		<div className="flex h-full w-full flex-col">
			<Editor
				author={author}
				cat={doc?.category || ""}
				id={id}
				note={JSON.stringify(doc?.content || "")}
				tit={doc?.title || ""}
			/>
		</div>
	);
}
