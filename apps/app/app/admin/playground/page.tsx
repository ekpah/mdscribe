import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import PlaygroundPageClient from "./PlaygroundPageClient";

export default async function PlaygroundPage() {
	const queryClient = getQueryClient();
	const modelsQueryOptions = orpc.admin.models.list.queryOptions();
	const topModelsQueryOptions = orpc.admin.models.topModels.queryOptions({
		input: { limit: 5 },
	});

	await Promise.all([
		queryClient.prefetchQuery(modelsQueryOptions),
		queryClient.prefetchQuery(topModelsQueryOptions),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<PlaygroundPageClient />
		</HydrationBoundary>
	);
}
