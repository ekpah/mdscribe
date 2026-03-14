"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { Button } from "@repo/design-system/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_PAGE_OPTIONS = [
	{
		href: "/admin/playground",
		isMatch: (pathname: string) => pathname.startsWith("/admin/playground"),
		label: "AI Playground",
	},
	{
		href: "/admin/templates",
		isMatch: (pathname: string) => pathname.startsWith("/admin/templates"),
		label: "Vorlagenverwaltung",
	},
	{
		href: "/admin/users",
		isMatch: (pathname: string) => pathname.startsWith("/admin/users"),
		label: "Benutzerverwaltung",
	},
	{
		href: "/admin/usage",
		isMatch: (pathname: string) => pathname.startsWith("/admin/usage"),
		label: "Nutzungsstatistik",
	},
	{
		href: "/admin/documents-playground",
		isMatch: (pathname: string) =>
			pathname.startsWith("/admin/documents-playground"),
		label: "Dokumenten-Playground",
	},
	{
		href: "/admin/settings/models",
		isMatch: (pathname: string) => pathname.startsWith("/admin/settings"),
		label: "Systemeinstellungen",
	},
] as const;

export const AdminBreadcrumb = () => {
	const pathname = usePathname();
	const isDashboard = pathname === "/admin";
	const currentPage = ADMIN_PAGE_OPTIONS.find((page) => page.isMatch(pathname));
	const currentPageLabel = isDashboard
		? "Bereich wechseln"
		: (currentPage?.label ?? "Bereich wechseln");

	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					{isDashboard ? (
						<BreadcrumbPage className="font-semibold text-sm text-solarized-base00">
							Admin-Dashboard
						</BreadcrumbPage>
					) : (
						<BreadcrumbLink asChild>
							<Link
								href="/admin"
								className="font-semibold text-sm text-solarized-base00 hover:text-solarized-blue"
							>
								Admin-Dashboard
							</Link>
						</BreadcrumbLink>
					)}
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-auto gap-1 px-1 py-0 font-semibold text-solarized-base00 text-sm hover:bg-transparent hover:text-solarized-blue"
							>
								{currentPageLabel}
								<ChevronDown className="h-3.5 w-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							{ADMIN_PAGE_OPTIONS.map((page) => {
								const isCurrent = page.isMatch(pathname);

								return (
									<DropdownMenuItem key={page.href} asChild>
										<Link
											href={page.href}
											className="flex w-full items-center justify-between"
										>
											<span>{page.label}</span>
											{isCurrent ? <Check className="h-4 w-4" /> : null}
										</Link>
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
};
