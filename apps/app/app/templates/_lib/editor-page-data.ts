import "server-only";

import { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export interface TemplateEditorData {
	cat: string;
	categorySuggestions: string[];
	tit: string;
	note: string;
	id?: string;
	canEditSource: boolean;
}

interface EditorContextData {
	categorySuggestions: string[];
	canEditSource: boolean;
}

const getCommonEditorData = async (
	queryClient: QueryClient,
): Promise<EditorContextData> => {
	return queryClient.fetchQuery(orpc.templates.editorContext.queryOptions());
};

export async function getCreateTemplateEditorData({
	forkId,
}: {
	forkId?: string;
}): Promise<TemplateEditorData> {
	const queryClient = new QueryClient();
	const sharedData = await getCommonEditorData(queryClient);
	const forkedTemplate = forkId
		? await queryClient.fetchQuery(
				orpc.templates.get.queryOptions({ input: { id: forkId } }),
			)
		: null;

	return {
		...sharedData,
		cat: forkedTemplate?.category || "",
		tit: forkedTemplate?.title || "",
		note: JSON.stringify(forkedTemplate?.content || ""),
	};
}

export async function getEditTemplateEditorData({
	id,
}: {
	id: string;
}): Promise<TemplateEditorData> {
	const queryClient = new QueryClient();
	const sharedData = await getCommonEditorData(queryClient);
	const doc = await queryClient.fetchQuery(
		orpc.templates.get.queryOptions({ input: { id } }),
	);

	if (!doc) {
		throw new Error("Document not found");
	}

	return {
		...sharedData,
		cat: doc.category || "",
		tit: doc.title || "",
		note: JSON.stringify(doc.content || ""),
		id,
	};
}
