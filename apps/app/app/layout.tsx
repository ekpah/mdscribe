import '@/lib/orpc.server' // for pre-rendering

import { DesignSystemProvider } from "@repo/design-system/providers";
import { env } from "@repo/env";
import { getServerSession } from "@/lib/server-session";
import { sessionQueryKey } from "@/lib/session-query";
import "@repo/design-system/styles/globals.css";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import MenubarSkeleton from "./_components/landing/skeletons/menubar-skeleton";
import QueryProvider from "./providers/query-provider";

const Menubar = dynamic(() => import("./_components/menubar"), {
	loading: () => <MenubarSkeleton />,
});

export const metadata: Metadata = {
	description: "A powerful, flexible, Markdown-based authoring framework",
	title: "MDScribe",
};

interface RootLayoutProperties {
	readonly children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProperties) {
	const session = await getServerSession();
	const isAdmin = session?.user?.email === env.ADMIN_EMAIL;
	const queryClient = new QueryClient();
	queryClient.setQueryData(sessionQueryKey, session);

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta content="width=device-width, initial-scale=1.0" name="viewport" />
				<meta content="strict-origin" name="referrer" />

				<link href="/favicon.ico" rel="shortcut icon" />
				<link href="/favicon.ico" rel="icon" />
			</head>
			<body
				className="items-center bg-background font-sans text-foreground"
			>
				<NuqsAdapter>
					<QueryProvider>
						<HydrationBoundary state={dehydrate(queryClient)}>
							<DesignSystemProvider>
								<div className="flex h-screen w-screen" key="Body">
									<nav className="fixed top-0 right-0 bottom-[calc(100vh-(--spacing(16)))] left-0 z-30 h-16">
										{/*ModeWatcher track="true" />*/}
										<Suspense fallback={<MenubarSkeleton />}>
											<Menubar initialSession={session} isAdmin={isAdmin} />
										</Suspense>
									</nav>
									<div
										className="sticky top-16 flex h-[calc(100vh-(--spacing(16)))] w-full items-center justify-center"
										key="Content"
									>
										{children}
									</div>
								</div>
							</DesignSystemProvider>
						</HydrationBoundary>
					</QueryProvider>
				</NuqsAdapter>
			</body>
		</html>
	);
}
