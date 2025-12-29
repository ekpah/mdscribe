import { database } from "@repo/database";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { QueryClient } from "@tanstack/react-query";
import { headers } from "next/headers";
import type React from "react";
import { Suspense } from "react";
import { auth } from "@/auth";
import { orpc } from "@/lib/orpc";
import AppSidebar from "./_components/Sidebar";

const getTemplatesPrisma = async () => {
	const templates = await database.template.findMany({
		include: {
			_count: {
				select: { favouriteOf: true },
			},
		},
	});
	return templates;
};
const getFavouriteTemplatesPrisma = async (isLoggedIn: boolean) => {
	if (!isLoggedIn) {
		return [];
	}
	try {
		const queryClient = new QueryClient();
		const templates = await queryClient.fetchQuery(
			orpc.user.templates.favourites.queryOptions(),
		);
		return templates;
	} catch (error) {
		// If authentication fails, return empty array instead of crashing
		console.warn("Failed to fetch favourite templates:", error);
		return [];
	}
};
const getAuthoredTemplatesPrisma = async (isLoggedIn: boolean) => {
	if (!isLoggedIn) {
		return [];
	}
	try {
		const queryClient = new QueryClient();
		const templates = await queryClient.fetchQuery(
			orpc.user.templates.authored.queryOptions(),
		);
		return templates;
	} catch (error) {
		// If authentication fails, return empty array instead of crashing
		console.warn("Failed to fetch authored templates:", error);
		return [];
	}
};

const generateSidebarLinks = async () => {
	const templates = await getTemplatesPrisma();
	return templates.map((temp) => ({
		url: `/templates/${temp.id}`,
		category: temp.category,
		title: temp.title,
		favouritesCount: temp._count.favouriteOf,
	}));
};
const generateFavouriteTemplates = async (isLoggedIn: boolean) => {
	const templates = await getFavouriteTemplatesPrisma(isLoggedIn);
	return templates.map((temp) => ({
		url: `/templates/${temp.id}`,
		category: temp.category,
		title: temp.title,
		favouritesCount: temp._count.favouriteOf,
	}));
};
const generateAuthoredTemplates = async (isLoggedIn: boolean) => {
	const templates = await getAuthoredTemplatesPrisma(isLoggedIn);
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
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	const isLoggedIn = !!session?.user;

	return (
		<div className="flex h-full w-full">
			<SidebarProvider>
				<Suspense
					fallback={
						<AppSidebar
							authoredTemplates={"[]"}
							favouriteTemplates={"[]"}
							isLoggedIn={isLoggedIn}
							key="Sidebar"
							templates={"[]"}
						/>
					}
				>
					<AppSidebar
						authoredTemplates={JSON.stringify(
							await generateAuthoredTemplates(isLoggedIn),
						)}
						favouriteTemplates={JSON.stringify(
							await generateFavouriteTemplates(isLoggedIn),
						)}
						isLoggedIn={isLoggedIn}
						key="Sidebar"
						templates={JSON.stringify(await generateSidebarLinks())}
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
