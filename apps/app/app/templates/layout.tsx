import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { QueryClient } from "@tanstack/react-query";
import type React from "react";
import { Suspense } from "react";

import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";
import AppSidebar from "./_components/Sidebar";

const getTemplates = async (queryClient: QueryClient) => {
	const templates = await queryClient.fetchQuery(
		orpc.templates.list.queryOptions(),
	);
	return templates;
};

const getFavouriteTemplates = async (
	queryClient: QueryClient,
	isLoggedIn: boolean,
) => {
	if (!isLoggedIn) {
		return [];
	}
	try {
		const templates = await queryClient.fetchQuery(
			orpc.templates.favourites.queryOptions(),
		);
		return templates;
	} catch (error) {
		// If authentication fails, return empty array instead of crashing
		console.warn("Failed to fetch favourite templates:", error);
		return [];
	}
};

const getAuthoredTemplates = async (
	queryClient: QueryClient,
	isLoggedIn: boolean,
) => {
	if (!isLoggedIn) {
		return [];
	}
	try {
		const templates = await queryClient.fetchQuery(
			orpc.templates.authored.queryOptions(),
		);
		return templates;
	} catch (error) {
		// If authentication fails, return empty array instead of crashing
		console.warn("Failed to fetch authored templates:", error);
		return [];
	}
};

const getCustomCollections = async (
	queryClient: QueryClient,
	isLoggedIn: boolean,
) => {
	if (!isLoggedIn) {
		return [];
	}
	try {
		const collections = await queryClient.fetchQuery(
			orpc.user.collections.list.queryOptions(),
		);
		return collections;
	} catch (error) {
		console.warn("Failed to fetch custom collections:", error);
		return [];
	}
};

const generateSidebarLinks = async (queryClient: QueryClient) => {
	const templates = await getTemplates(queryClient);
	return templates.map((temp) => ({
		url: `/templates/${temp.id}`,
		category: temp.category,
		title: temp.title,
		favouritesCount: temp._count.favouriteOf,
	}));
};

const generateFavouriteTemplates = async (
	queryClient: QueryClient,
	isLoggedIn: boolean,
) => {
	const templates = await getFavouriteTemplates(queryClient, isLoggedIn);
	return templates.map((temp) => ({
		url: `/templates/${temp.id}`,
		category: temp.category,
		title: temp.title,
		favouritesCount: temp._count.favouriteOf,
	}));
};

const generateAuthoredTemplates = async (
	queryClient: QueryClient,
	isLoggedIn: boolean,
) => {
	const templates = await getAuthoredTemplates(queryClient, isLoggedIn);
	return templates.map((temp) => ({
		url: `/templates/${temp.id}`,
		category: temp.category,
		title: temp.title,
		favouritesCount: temp._count.favouriteOf,
	}));
};

export default async function Layout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getServerSession();
	const isLoggedIn = !!session?.user;
	const queryClient = new QueryClient();

	return (
		<div className="flex h-full w-full">
			<SidebarProvider>
				<Suspense
					fallback={
						<AppSidebar
							authoredTemplates={"[]"}
							customCollections={"[]"}
							favouriteTemplates={"[]"}
							isLoggedIn={isLoggedIn}
							key="Sidebar"
							templates={"[]"}
						/>
					}
				>
					<AppSidebar
						authoredTemplates={JSON.stringify(
							await generateAuthoredTemplates(queryClient, isLoggedIn),
						)}
						customCollections={JSON.stringify(
							await getCustomCollections(queryClient, isLoggedIn),
						)}
						favouriteTemplates={JSON.stringify(
							await generateFavouriteTemplates(queryClient, isLoggedIn),
						)}
						isLoggedIn={isLoggedIn}
						key="Sidebar"
						templates={JSON.stringify(await generateSidebarLinks(queryClient))}
					/>
				</Suspense>
				<main
					className="top-16 flex h-full grow overscroll-contain p-2"
					key="MainContent"
				>
					{children}
				</main>
			</SidebarProvider>
		</div>
	);
}
