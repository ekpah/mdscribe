import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@repo/design-system/components/ui/breadcrumb";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import type { Metadata } from "next";

import PDFFormSection from "./_components/PDFFormSection";

export const metadata: Metadata = {
	title: "PDF-Formular ausfüllen",
	description: "PDF-Formulare hochladen und ausfüllen",
};

export default function DocumentsPage() {
	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex h-10 items-center justify-between gap-2">
				<SidebarTrigger className="ml-4 block md:hidden" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbPage>PDF-Formular ausfüllen</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<PDFFormSection />
		</div>
	);
}
