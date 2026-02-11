import { auth } from "@/auth";
import { env } from "@repo/env";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminBreadcrumb } from "./_components/AdminBreadcrumb";

interface AdminLayoutProps {
	children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
	// Check authentication
	const headersList = await headers();
	const session = await auth.api.getSession({
		headers: headersList,
	});

	if (!session?.user) {
		redirect("/");
	}

	// Check admin access
	if (session.user.email !== env.ADMIN_EMAIL) {
		redirect("/");
	}

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-solarized-base3">
			{/* Admin header with breadcrumbs */}
			<div className="shrink-0 border-solarized-base2 border-b bg-solarized-base2 px-4 py-1.5">
				<div className="flex items-center justify-between">
					<AdminBreadcrumb />
					<div className="text-xs text-solarized-base01">
						<span className="hidden sm:inline">Angemeldet als: </span>
						<span className="font-medium">{session.user.email}</span>
					</div>
				</div>
			</div>
			{/* Scrollable content area */}
			<div className="flex-1 overflow-y-auto">{children}</div>
		</div>
	);
}
