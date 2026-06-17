import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import { LicensePageClient } from "./license-page-client";

export default async function AdminLicensePage() {
	const queryClient = getQueryClient();
	await queryClient.prefetchQuery(orpc.admin.license.get.queryOptions());

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<LicensePageClient />
		</HydrationBoundary>
	);
}
