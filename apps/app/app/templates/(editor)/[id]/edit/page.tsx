import type { Metadata } from "next";
import Editor from "../../../_components/Editor";
import { getEditTemplateEditorData } from "../../../_lib/editor-page-data";

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
	const { id } = params;
	const editorData = await getEditTemplateEditorData({ id });

	return (
		<div className="flex h-full w-full flex-col">
			<Editor {...editorData} />
		</div>
	);
}
