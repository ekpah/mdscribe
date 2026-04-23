import type { Metadata } from "next";

import DocumentEditor from "@/app/documents/_components/document-editor";

export const generateMetadata = (): Metadata => ({
	title: "Scribe - Dokument bearbeiten",
});

export default async function EditDocumentPage(
	props: PageProps<"/documents/[id]/edit">,
) {
	const params = await props.params;

	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-2">
			<DocumentEditor documentId={params.id} />
		</div>
	);
}
