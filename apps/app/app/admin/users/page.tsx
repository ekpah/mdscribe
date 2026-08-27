import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import UsersPageClient from "./users-page-client";

export default async function UsersPage() {
	const queryClient = getQueryClient();
	const usersQueryOptions = orpc.admin.users.list.queryOptions();

	await queryClient.prefetchQuery(usersQueryOptions);

	return (
		<HydrationBoundary state={dehydrate(queryClient)}>
			<UsersPageClient />
		</HydrationBoundary>
	);
}
