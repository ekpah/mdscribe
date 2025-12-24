"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import Link from "next/link";
import { usePathname } from "next/navigation";

function getPageTitle(pathname: string): string {
	if (pathname === "/admin") {
		return "Dashboard";
	}
	if (pathname.startsWith("/admin/migrateEmbeddings")) {
		return "Embedding-Migration";
	}
	if (pathname.startsWith("/admin/users")) {
		return "Benutzerverwaltung";
	}
	if (pathname.startsWith("/admin/templates")) {
		return "Vorlagenverwaltung";
	}
	if (pathname.startsWith("/admin/settings")) {
		return "Systemeinstellungen";
	}
	return "Admin";
}

export function AdminBreadcrumb() {
	const pathname = usePathname();
	const isDashboard = pathname === "/admin";
	const pageTitle = getPageTitle(pathname);

	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					{isDashboard ? (
						<BreadcrumbPage className="font-semibold text-sm text-solarized-base00">
							Admin-Dashboard
						</BreadcrumbPage>
					) : (
						<>
							<BreadcrumbLink asChild>
								<Link
									href="/admin"
									className="font-semibold text-sm text-solarized-base00 hover:text-solarized-blue"
								>
									Admin-Dashboard
								</Link>
							</BreadcrumbLink>
							<BreadcrumbSeparator />
							<BreadcrumbPage className="font-semibold text-sm text-solarized-base00">
								{pageTitle}
							</BreadcrumbPage>
						</>
					)}
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}

