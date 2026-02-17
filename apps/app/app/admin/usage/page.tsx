import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import UsagePageClient from "./UsagePageClient";

export default async function UsagePage() {
	const queryClient = getQueryClient();
	const statsQueryOptions = orpc.admin.usage.stats.queryOptions({
		input: { filter: "month" },
	});
	const listQueryOptions = orpc.admin.usage.list.queryOptions({
		input: { limit: 25 },
	});

	await Promise.all([
		queryClient.prefetchQuery(statsQueryOptions),
		queryClient.prefetchQuery(listQueryOptions),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<UsagePageClient />
		</HydrationBoundary>
	);
}
