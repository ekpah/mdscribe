import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import { ModelComparisonPageClient } from "./model-comparison-page-client";

export default async function ModelComparisonPage() {
	const queryClient = getQueryClient();
	const modelsQueryOptions = orpc.admin.models.list.queryOptions();
	const topModelsQueryOptions = orpc.admin.models.topModels.queryOptions({
		input: { limit: 5 },
	});
	const usageListQueryOptions = orpc.admin.usage.list.queryOptions({
		input: { limit: 100, name: "ai_scribe_generation" },
	});

	await Promise.all([
		queryClient.prefetchQuery(modelsQueryOptions),
		queryClient.prefetchQuery(topModelsQueryOptions),
		queryClient.prefetchQuery(usageListQueryOptions),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ModelComparisonPageClient />
		</HydrationBoundary>
	);
}
