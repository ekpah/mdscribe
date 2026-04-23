import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import { Card } from "@repo/design-system/components/ui/card";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import Link from "next/link";

export default function DocumentsPage() {
	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex h-10 items-center justify-between gap-2">
				<SidebarTrigger className="ml-4 block md:hidden" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<Link href="/documents">Dokumente</Link>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbPage>...</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<div />
			</div>
			<Card className="h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] overflow-y-auto p-4">
				<div className="space-y-2">
					<h1 className="font-semibold text-lg">Dokumentbibliothek</h1>
					<p className="text-muted-foreground text-sm">
						Wählen Sie links ein Dokument oder erstellen Sie ein neues PDF-Formular.
					</p>
				</div>
			</Card>
		</div>
	);
}
