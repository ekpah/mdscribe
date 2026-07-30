import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import AdminTemplatesPageClient from "./templates-page-client";

export default async function AdminTemplatesPage() {
	const queryClient = getQueryClient();
	const templatesQueryOptions = orpc.admin.templates.list.queryOptions();

	await queryClient.prefetchQuery(templatesQueryOptions);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<AdminTemplatesPageClient />
		</HydrationBoundary>
	);
}
