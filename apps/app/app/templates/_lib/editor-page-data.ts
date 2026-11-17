import "server-only";
import { QueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

interface TemplateEditorData {
	tit: string;
	note: string;
	examples: string[];
	information: string;
	id?: string;
	canCreatePrivateTemplates: boolean;
	isTemplateAgentEnabled: boolean;
	visibility: "public" | "private";
}

interface EditorContextData {
	canCreatePrivateTemplates: boolean;
	isTemplateAgentEnabled: boolean;
}

const getCommonEditorData = (queryClient: QueryClient): Promise<EditorContextData> =>
	queryClient.fetchQuery(orpc.templates.editorContext.queryOptions());

export const getCreateTemplateEditorData = async ({
	forkId,
}: {
	forkId?: string;
}): Promise<TemplateEditorData> => {
	const queryClient = new QueryClient();
	const sharedData = await getCommonEditorData(queryClient);
	const forkedTemplate = forkId
		? await queryClient.fetchQuery(orpc.templates.get.queryOptions({ input: { id: forkId } }))
		: null;

	return {
		...sharedData,
		examples: forkedTemplate?.examples ?? [],
		information: forkedTemplate?.information ?? "",
		note: JSON.stringify(forkedTemplate?.content || ""),
		tit: forkedTemplate?.title || "",
		visibility:
			forkedTemplate?.visibility === "private" && sharedData.canCreatePrivateTemplates
				? "private"
				: "public",
	};
};

export const getEditTemplateEditorData = async ({
	id,
}: {
	id: string;
}): Promise<TemplateEditorData> => {
	const queryClient = new QueryClient();
	const sharedData = await getCommonEditorData(queryClient);
	const doc = await queryClient.fetchQuery(orpc.templates.get.queryOptions({ input: { id } }));

	if (!doc) {
		throw new Error("Document not found");
	}

	return {
		...sharedData,
		examples: doc.examples ?? [],
		id,
		information: doc.information ?? "",
		note: JSON.stringify(doc.content || ""),
		tit: doc.title || "",
		visibility: doc.visibility === "private" ? "private" : "public",
	};
};
