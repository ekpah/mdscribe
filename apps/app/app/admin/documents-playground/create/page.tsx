import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import CreateDocumentSection from "./_components/CreateDocumentSection";

export const metadata: Metadata = {
	description: "Erstellen Sie ein neues Dokument mit PDF-Formular-Integration",
	title: "Dokument erstellen",
};

export default function CreateDocumentPage() {
	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-magenta/10 sm:h-12 sm:w-12">
							<FilePlus2 className="h-5 w-5 text-solarized-magenta sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
								Dokument erstellen
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								Feldzuordnungen bearbeiten und PDF-Templates mit KI vorbereiten
							</p>
						</div>
					</div>
				</div>
				<CreateDocumentSection />
			</div>
		</div>
	);
}
