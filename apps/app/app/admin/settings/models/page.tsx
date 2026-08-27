import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import ModelsSettingsPageClient from "./models-settings-page-client";

export default async function ModelsSettingsPage() {
	const queryClient = getQueryClient();
	const connectionsQueryOptions = orpc.admin.providers.connections.list.queryOptions();
	const defaultsQueryOptions = orpc.admin.providers.defaults.get.queryOptions();

	await Promise.all([
		queryClient.prefetchQuery(connectionsQueryOptions),
		queryClient.prefetchQuery(defaultsQueryOptions),
	]);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<ModelsSettingsPageClient />
		</HydrationBoundary>
	);
}
