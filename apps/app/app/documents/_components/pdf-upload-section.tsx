"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { formatBytes, FileDropzone } from "@repo/design-system/components/ui/file-dropzone";
import { PaperclipIcon, XIcon } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { MAX_PDF_UPLOAD_BYTES } from "@/app/documents/_lib/pdf-data";

interface PDFUploadSectionProps {
	onClear: () => void;
	onFileUpload: (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => void;
	pdfFile: Uint8Array | null;
	pdfFileName?: string;
}

const getFirstBrowserFile = (addedFiles: { file: unknown }[]): File | null => {
	const firstFile = addedFiles[0]?.file;
	return firstFile instanceof File ? firstFile : null;
};

const handleAddedPdfFiles = async (
	addedFiles: { file: unknown }[],
	onFileUpload: (file: Uint8Array, fileMeta: { name: string; mimeType: string }) => void,
) => {
	const firstFile = getFirstBrowserFile(addedFiles);
	if (!firstFile) {
		return;
	}

	if (firstFile.size > MAX_PDF_UPLOAD_BYTES) {
		toast.error(`Datei zu groß. Maximal erlaubt: ${formatBytes(MAX_PDF_UPLOAD_BYTES)}`);
		return;
	}

	const arrayBuffer = await firstFile.arrayBuffer();
	onFileUpload(new Uint8Array(arrayBuffer), {
		mimeType: firstFile.type || "application/pdf",
		name: firstFile.name || "document.pdf",
	});
	toast.success("Dokument hochgeladen");
};

export const PDFUploadSection = ({
	onClear,
	onFileUpload,
	pdfFile,
	pdfFileName,
}: PDFUploadSectionProps) => {
	const handleClearFile = useCallback(() => {
		onClear();
	}, [onClear]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				{!pdfFile && (
					<FileDropzone
						accept="application/pdf"
						description={
							<>
								Ziehen & ablegen oder klicken zum Durchsuchen (max.{" "}
								{formatBytes(MAX_PDF_UPLOAD_BYTES)})
							</>
						}
						disableAfterSelection
						maxSize={MAX_PDF_UPLOAD_BYTES}
						onFilesAdded={(addedFiles) => handleAddedPdfFiles(addedFiles, onFileUpload)}
						title="Datei hochladen"
					/>
				)}

				{pdfFile && (
					<div className="space-y-2">
						<div
							className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2"
							key="pdf-file"
						>
							<div className="flex items-center gap-3 overflow-hidden">
								<PaperclipIcon aria-hidden="true" className="size-4 shrink-0 opacity-60" />
								<div className="min-w-0">
									<p className="truncate font-medium text-[13px]">
										{pdfFileName || "document.pdf"}
									</p>
								</div>
							</div>

							<Button
								aria-label="Datei entfernen"
								className="-me-2 size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
								onClick={handleClearFile}
								size="icon"
								variant="ghost"
							>
								<XIcon aria-hidden="true" className="size-4" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
