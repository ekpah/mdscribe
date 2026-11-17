import { QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplateNavigation } from "@/app/templates/_components/template-navigation";
import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";

import ContentSection from "./_components/content-section";

type TemplateContentView = "template" | "examples" | "information";

export const generateMetadata = async ({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> => {
	const { id } = await params;
	const queryClient = new QueryClient();
	const doc = await queryClient.fetchQuery(orpc.templates.get.queryOptions({ input: { id } }));

	return {
		title: doc?.title,
	};
};

const NotePage = async ({ params, searchParams }: PageProps<"/templates/[id]">) => {
	const queryClient = new QueryClient();
	const session = await getServerSession();
	const { id } = await params;
	const { view } = await searchParams;
	const contentView: TemplateContentView =
		view === "examples" || view === "information" ? view : "template";
	const doc = await queryClient.fetchQuery(orpc.templates.get.queryOptions({ input: { id } }));
	if (!doc) {
		notFound();
	}

	const isAuthor = doc.authorId === session?.user?.id;

	return (
		<div className="flex h-full w-full flex-col">
			<ContentSection
				key={doc.id}
				contentView={contentView}
				navActions={{
					author: doc.author?.name ?? undefined,
					isAuthor,
					isLoggedIn: !!session?.user?.id,
					lastEdited: doc.updatedAt,
					templateId: doc.id,
					visibility: doc.visibility === "private" ? "private" : "public",
				}}
				navigation={<TemplateNavigation entry={{ id: doc.id, kind: "text", title: doc.title }} />}
				examples={doc.examples}
				information={doc.information}
				note={doc.content}
			/>
		</div>
	);
};

export default NotePage;
