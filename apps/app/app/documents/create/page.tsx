import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@repo/design-system/components/ui/breadcrumb";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import type { Metadata } from "next";

import CreateDocumentSection from "./_components/CreateDocumentSection";

export const metadata: Metadata = {
	title: "Dokument erstellen",
	description: "Erstellen Sie ein neues Dokument mit PDF-Formular-Integration",
};

export default function CreateDocumentPage() {
	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex h-10 items-center justify-between gap-2">
				<SidebarTrigger className="ml-4 block md:hidden" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbPage>Dokument erstellen</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<CreateDocumentSection />
		</div>
	);
}
