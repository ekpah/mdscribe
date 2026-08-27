import { QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import DocumentEditor from "@/app/documents/_components/document-editor";
import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";

export const generateMetadata = (): Metadata => ({
	title: "Scribe - Dokument bearbeiten",
});

export default async function EditDocumentPage(props: PageProps<"/documents/[id]/edit">) {
	const [params, session] = await Promise.all([props.params, getServerSession()]);
	const queryClient = new QueryClient();
	const document = await queryClient.fetchQuery(
		orpc.documents.templates.get.queryOptions({ input: { id: params.id } }),
	);
	if (!document) {
		notFound();
	}
	if (document.authorId !== session?.user.id) {
		redirect(`/documents/create?fork=${document.id}`);
	}

	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-2">
			<DocumentEditor documentId={params.id} />
		</div>
	);
}
