import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { env } from "@/env";
import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";

import { AdminLayoutHeader } from "./_components/admin-layout-header";

interface AdminLayoutProps {
	children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
	// Check authentication
	const requestHeaders = await headers();
	const session = await getServerSession();

	if (!session?.user) {
		const requestedPath = getRequestedPath(requestHeaders, "/admin");
		redirect(createSignInRedirect(requestedPath));
	}

	// Check admin access
	if (session.user.email !== env.ADMIN_EMAIL) {
		redirect("/");
	}

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-solarized-base3">
			<AdminLayoutHeader />
			{/* Scrollable content area */}
			<div className="flex-1 overflow-y-auto">{children}</div>
		</div>
	);
}
