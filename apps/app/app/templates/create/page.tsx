import { database, eq, template } from "@repo/database";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Editor from "../_components/Editor";
import { getTemplateCategorySuggestions } from "../_lib/category-suggestions";

export const dynamicParams = false;

type MetadataProps = {
	params: Promise<{ template: [category: string, name: string] }>;
};

export function generateMetadata(props: MetadataProps): Metadata {
	return {
		title: "Scribe - Template erstellen",
	};
}

async function fetchMarkdoc({ id }: { id: string }) {
	const [doc] = await database.select().from(template).where(eq(template.id, id)).limit(1);
	return doc;
}

export default async function CreateTemplate({
	searchParams,
}: PageProps<"/templates/create">) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session?.user) {
		redirect("/");
	}

	// get the search parameter fork to check, whether an existing template should be forked
	const { fork } = await searchParams;

	const forkedTemplate = fork
		? await fetchMarkdoc({ id: fork as string })
		: null;
	const categorySuggestions = await getTemplateCategorySuggestions(session.user.id);

	return (
		<div className="flex h-full w-full flex-col">
			<Editor
				cat={forkedTemplate?.category || ""}
				categorySuggestions={categorySuggestions}
				tit={forkedTemplate?.title || ""}
				note={JSON.stringify(forkedTemplate?.content || "")}
				author={session?.user}
			/>
		</div>
	);
}
