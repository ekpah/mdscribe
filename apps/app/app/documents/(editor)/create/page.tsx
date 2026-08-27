import type { Metadata } from "next";

import DocumentEditor from "@/app/documents/_components/document-editor";

export const generateMetadata = (): Metadata => ({
	title: "Scribe - Dokument erstellen",
});

export default async function CreateDocumentPage({ searchParams }: PageProps<"/documents/create">) {
	const { fork } = await searchParams;

	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-2">
			<DocumentEditor forkId={typeof fork === "string" ? fork : undefined} />
		</div>
	);
}
