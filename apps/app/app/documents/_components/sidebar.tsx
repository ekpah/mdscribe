"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
	ChevronRight,
	FileText,
	Folder,
	PlusCircle,
	Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

interface SidebarDocument {
	category: string;
	title: string;
	url: string;
}

interface SidebarSegment {
	category: string;
	documents: SidebarDocument[];
}

const groupByCategory = (documents: SidebarDocument[]): SidebarSegment[] => {
	const groups = new Map<string, SidebarDocument[]>();

	for (const document of documents) {
		const existing = groups.get(document.category) ?? [];
		existing.push(document);
		groups.set(document.category, existing);
	}

	return Array.from(groups.entries())
		.map(([category, categoryDocuments]) => ({
			category,
			documents: categoryDocuments.sort((a, b) => a.title.localeCompare(b.title)),
		}))
		.sort((a, b) => a.category.localeCompare(b.category));
};

export default function DocumentsSidebar({
	documents,
	isLoggedIn,
}: {
	documents: string;
	isLoggedIn: boolean;
}) {
	const { setOpenMobile } = useSidebar();
	const searchParams = useSearchParams();
	const [searchTerm, setSearchTerm] = useState(searchParams.get("filter") || "");

	const parsedDocuments = useMemo(
		() => JSON.parse(documents) as SidebarDocument[],
		[documents],
	);

	const filteredDocuments = useMemo(() => {
		const normalizedTerm = searchTerm.trim().toLowerCase();
		if (!normalizedTerm) {
			return parsedDocuments;
		}

		return parsedDocuments.filter((document) => {
			return (
				document.title.toLowerCase().includes(normalizedTerm) ||
				document.category.toLowerCase().includes(normalizedTerm)
			);
		});
	}, [parsedDocuments, searchTerm]);

	const segments = useMemo(
		() => groupByCategory(filteredDocuments),
		[filteredDocuments],
	);

	const handleSearchChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setSearchTerm(event.currentTarget.value);
		},
		[],
	);

	const createHref = isLoggedIn
		? "/documents/create"
		: "/sign-in?redirect=%2Fdocuments%2Fcreate";

	return (
		<Sidebar className="top-16 h-[calc(100vh-(--spacing(16)))]" collapsible="offcanvas">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild size="lg">
							<Link href="/documents">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<FileText className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Dokumente</span>
									<span className="truncate text-xs">PDF-Formulare</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild tooltip="Neues Dokument">
							<Link href={createHref}>
								<PlusCircle />
								<span>Neues Dokument</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<form>
					<SidebarGroup className="py-0">
						<SidebarGroupContent className="relative">
							<label className="sr-only" htmlFor="documents-search">
								Dokument suchen
							</label>
							<SidebarInput
								id="documents-search"
								onChange={handleSearchChange}
								placeholder="Dokument suchen..."
								value={searchTerm}
							/>
							<Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 select-none opacity-50" />
						</SidebarGroupContent>
					</SidebarGroup>
				</form>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{segments.map((segment) => (
								<Collapsible className="group/collapsible" defaultOpen key={segment.category}>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton>
												<Folder />
												<span>{segment.category}</span>
												<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{segment.documents.map((document) => (
													<SidebarMenuSubItem key={document.url}>
														<SidebarMenuSubButton asChild>
															<Link
																className="flex items-center"
																href={document.url}
																onClick={() => setOpenMobile(false)}
															>
																<span>{document.title}</span>
															</Link>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
