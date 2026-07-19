"use client";

import {
	NavigationSidebar,
	NavigationSidebarBrand,
	NavigationSidebarSearch,
	groupNavigationItemsByCategory,
} from "@/app/_components/sidebar/navigation-sidebar";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { FileText, Folder, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useMemo, useState } from "react";

interface SidebarDocument {
	category: string;
	title: string;
	url: string;
}

export default function DocumentsSidebar({
	documents,
	isLoggedIn,
}: {
	documents: string;
	isLoggedIn: boolean;
}) {
	const searchParams = useSearchParams();
	const [searchTerm, setSearchTerm] = useState(searchParams.get("filter") || "");

	const parsedDocuments = useMemo(() => JSON.parse(documents) as SidebarDocument[], [documents]);

	const filteredDocuments = useMemo(() => {
		const normalizedTerm = searchTerm.trim().toLowerCase();
		if (!normalizedTerm) {
			return parsedDocuments;
		}

		return parsedDocuments.filter(
			(document) =>
				document.title.toLowerCase().includes(normalizedTerm) ||
				document.category.toLowerCase().includes(normalizedTerm),
		);
	}, [parsedDocuments, searchTerm]);

	const sections = useMemo(
		() =>
			groupNavigationItemsByCategory(filteredDocuments).map((section) => ({
				...section,
				icon: Folder,
			})),
		[filteredDocuments],
	);

	const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(event.currentTarget.value);
	}, []);

	const createHref = isLoggedIn ? "/documents/create" : "/sign-in?redirect=%2Fdocuments%2Fcreate";

	return (
		<NavigationSidebar
			className="top-16 h-[calc(100vh-(--spacing(16)))]"
			controls={
				<>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton tooltip="Neues Dokument" render={<Link href={createHref}>
									<PlusCircle />
									<span>Neues Dokument</span>
								</Link>} />
						</SidebarMenuItem>
					</SidebarMenu>
					<NavigationSidebarSearch
						id="documents-search"
						label="Dokument suchen"
						onChange={handleSearchChange}
						placeholder="Dokument suchen..."
						value={searchTerm}
					/>
				</>
			}
			header={
				<NavigationSidebarBrand
					href="/documents"
					icon={FileText}
					subtitle="PDF-Formulare"
					title="Dokumente"
				/>
			}
			sections={sections}
		/>
	);
}
