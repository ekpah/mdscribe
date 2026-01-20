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
		<div className="flex h-full w-full flex-col p-3">
			<PDFFormSection />
		</div>
	);
}
