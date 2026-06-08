import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { DocumentPlaygroundClient } from "./_components/document-playground-client";

export const metadata: Metadata = {
	description: "PDF-Dateien mit auswählbarem OCR-Modell zu Markdoc oder Text verarbeiten",
	title: "Dokumenten-Playground",
};

export default function DocumentsPage() {
	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-magenta/10 sm:h-12 sm:w-12">
							<FileText className="h-5 w-5 text-solarized-magenta sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
								Dokumenten-Playground
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								PDF-Dateien hochladen, OCR-Modell wechseln und Markdoc oder Text prüfen
							</p>
						</div>
					</div>
				</div>
				<DocumentPlaygroundClient />
			</div>
		</div>
	);
}
