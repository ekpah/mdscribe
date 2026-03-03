import type { Metadata } from "next";
import Editor from "../../_components/editor";
import { getCreateTemplateEditorData } from "../../_lib/editor-page-data";

export const dynamicParams = false;

export function generateMetadata(): Metadata {
	return {
		title: "Scribe - Template erstellen",
	};
}

export default async function CreateTemplate({
	searchParams,
}: PageProps<"/templates/create">) {
	const { fork } = await searchParams;
	const editorData = await getCreateTemplateEditorData({
		forkId: typeof fork === "string" ? fork : undefined,
	});

	return (
		<div className="flex h-full w-full flex-col">
			<Editor {...editorData} />
		</div>
	);
}
