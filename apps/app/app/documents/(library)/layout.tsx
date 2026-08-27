import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { Suspense } from "react";

import DocumentsSidebar from "@/app/documents/_components/sidebar";
import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";

const getDocuments = async (queryClient: QueryClient) => {
	const documents = await queryClient.fetchQuery(orpc.documents.templates.list.queryOptions());
	return documents;
};

const generateSidebarLinks = async (queryClient: QueryClient) => {
	const documents = await getDocuments(queryClient);
	return documents.map((document) => ({
		category: document.category,
		title: document.title,
		url: `/documents/${document.id}`,
	}));
};

export default async function Layout({ children }: { children: React.ReactNode }) {
	const session = await getServerSession();
	const isLoggedIn = Boolean(session?.user);
	const queryClient = new QueryClient();

	return (
		<div className="flex h-full w-full">
			<SidebarProvider>
				<Suspense fallback={<DocumentsSidebar documents="[]" isLoggedIn={isLoggedIn} />}>
					<DocumentsSidebar
						documents={JSON.stringify(await generateSidebarLinks(queryClient))}
						isLoggedIn={isLoggedIn}
					/>
				</Suspense>
				<main className="top-16 flex h-full grow overscroll-contain p-2">{children}</main>
			</SidebarProvider>
		</div>
	);
}
