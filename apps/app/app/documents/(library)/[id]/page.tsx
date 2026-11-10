import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ContentSection from "@/app/documents/(library)/[id]/_components/content-section";
import { NavActions } from "@/app/documents/(library)/[id]/_components/nav-actions";
import { documentDefinitionSchema, normalizeDocumentDefinition } from "@/app/documents/_lib";
import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";

export const generateMetadata = async ({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> => {
	const { id } = await params;
	const queryClient = new QueryClient();
	const document = await queryClient.fetchQuery(
		orpc.documents.templates.get.queryOptions({ input: { id } }),
	);

	return {
		title: document?.title,
	};
};

const DocumentPage = async ({ params }: PageProps<"/documents/[id]">) => {
	const queryClient = new QueryClient();
	const session = await getServerSession();
	const { id } = await params;

	const document = await queryClient.fetchQuery(
		orpc.documents.templates.get.queryOptions({ input: { id } }),
	);

	if (!document) {
		notFound();
	}

	const isAuthor = document.authorId === session?.user?.id;
	const parsedDefinition = documentDefinitionSchema.safeParse(document.fieldDefinitions);
	if (!parsedDefinition.success) {
		notFound();
	}
	const definition = normalizeDocumentDefinition(parsedDefinition.data);

	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex h-10 items-center justify-between gap-2">
				<SidebarTrigger className="ml-4 block md:hidden" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<Link href="/documents">Dokumente</Link>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>{document.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<NavActions
					author={document.author?.name || undefined}
					documentId={document.id}
					isAuthor={isAuthor}
					isLoggedIn={Boolean(session?.user?.id)}
					lastEdited={document.updatedAt}
					visibility={document.visibility === "private" ? "private" : "public"}
				/>
			</div>
			<ContentSection
				downloadFileName={`${document.title}.pdf`}
				documentId={document.id}
				definition={definition}
				information={document.information}
			/>
		</div>
	);
};

export default DocumentPage;
