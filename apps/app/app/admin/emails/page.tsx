import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import AdminEmailsPageClient from "./emails-page-client";

export default async function AdminEmailsPage() {
	const queryClient = getQueryClient();
	const draftsQueryOptions = orpc.admin.emails.list.queryOptions();
	const drafts = await queryClient.fetchQuery(draftsQueryOptions);
	const firstDraft = drafts[0];

	if (firstDraft) {
		await queryClient.prefetchQuery(
			orpc.admin.emails.preview.queryOptions({
				input: { id: firstDraft.id },
			}),
		);
	}

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AdminEmailsPageClient />
		</HydrationBoundary>
	);
}
