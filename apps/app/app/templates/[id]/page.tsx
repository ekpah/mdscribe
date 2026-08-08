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
import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";
import ContentSection from "./_components/content-section";
import { NavActions } from "./_components/nav-actions";

type TemplateContentView = "template" | "examples" | "information";

export const generateMetadata = async ({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> => {
	const { id } = await params;
	const queryClient = new QueryClient();
	const doc = await queryClient.fetchQuery(
		orpc.templates.get.queryOptions({ input: { id } }),
	);

	return {
		title: doc?.title,
	};
};

const NotePage = async ({
	params,
	searchParams,
}: PageProps<"/templates/[id]">) => {
	const queryClient = new QueryClient();
	const session = await getServerSession();
	const { id } = await params;
	const { view } = await searchParams;
	const contentView: TemplateContentView =
		view === "examples" || view === "information" ? view : "template";
	const doc = await queryClient.fetchQuery(
		orpc.templates.get.queryOptions({ input: { id } }),
	);
	if (!doc) {
		throw new Error("Document not found");
	}

	const isFavourite = doc?.favouriteOf.some(
		(user: { id: string | undefined }) => user.id === session?.user?.id,
	);
	const isAuthor = doc.authorId === session?.user?.id;

	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex h-10 items-center justify-between gap-2">
				{session?.user && <SidebarTrigger className="ml-4 block md:hidden" />}
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<Link href="/templates">Textbausteine</Link>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>{doc?.title}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<NavActions
					author={doc.author?.name ?? undefined}
					isAuthor={isAuthor}
					isFavourite={isFavourite}
					isLoggedIn={!!session?.user?.id}
					lastEdited={doc.updatedAt}
					templateId={doc.id}
					visibility={doc.visibility === "private" ? "private" : "public"}
				/>
			</div>
			<ContentSection
				contentView={contentView}
				examples={doc.examples}
				information={doc.information}
				note={doc.content}
			/>
		</div>
	);
};

export default NotePage;
