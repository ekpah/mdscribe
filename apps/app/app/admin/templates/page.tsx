import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import AdminTemplatesPageClient from "./templates-page-client";

export default async function AdminTemplatesPage() {
	const queryClient = getQueryClient();
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();
	const statsQueryOptions = orpc.admin.embeddings.stats.queryOptions();

	await Promise.all([
		queryClient.prefetchQuery(templatesQueryOptions),
		queryClient.prefetchQuery(statsQueryOptions),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AdminTemplatesPageClient />
		</HydrationBoundary>
	);
}
