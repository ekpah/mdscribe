import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { QueryClient } from "@tanstack/react-query";
import { auth } from "@/auth";
import { orpc } from "@/lib/orpc";
import Editor from "../../_components/Editor";
import { getTemplateCategorySuggestions } from "../../_lib/category-suggestions";

export const dynamicParams = false;

type MetadataProps = {
	params: Promise<{ template: [category: string, name: string] }>;
};

export async function generateMetadata(
	props: MetadataProps,
): Promise<Metadata> {
	const params = await props.params;
	const { template: templateParam } = params;
	const [_category, name] = templateParam
		? templateParam
		: [undefined, "Scribe"];
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
	const queryClient = new QueryClient();
	const doc = await queryClient.fetchQuery(
		orpc.templates.get.queryOptions({ input: { id } }),
	);
	if (!doc) {
		throw new Error("Document not found");
	}
	const categorySuggestions = await getTemplateCategorySuggestions(session.user.id);

	const author = doc.author;
	if (!author) {
		throw new Error("Author not found");
	}
	return (
		<div className="flex h-full w-full flex-col">
			<Editor
				author={author}
				cat={doc?.category || ""}
				categorySuggestions={categorySuggestions}
				id={id}
				note={JSON.stringify(doc?.content || "")}
				tit={doc?.title || ""}
			/>
		</div>
	);
}
