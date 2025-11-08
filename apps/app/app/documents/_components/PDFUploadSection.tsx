"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	formatBytes,
	useFileUpload,
} from "@repo/design-system/hooks/use-file-upload";
import type { InputTagType } from "@repo/markdoc-md/parse/parseMarkdocToInputs";
import {
	AlertCircleIcon,
	Download,
	PaperclipIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { parsePDFFormFields } from "../_lib/parsePDFFormFields";

interface PDFUploadSectionProps {
	pdfFile: File | null;
	fieldValues: Record<string, unknown>;
	fieldMapping: Record<string, string>;
	filledPdfUrl: string | null;
	onFileUpload: (
		file: File,
		inputTags: InputTagType[],
		fieldMapping: Record<string, string>,
		fields: any[],
	) => void;
	onPdfFilled: (url: string) => void;
}

const maxSize = 10 * 1024 * 1024; // 10MB

export default function PDFUploadSection({
	pdfFile,
	fieldValues,
	fieldMapping,
	filledPdfUrl,
	onFileUpload,
	onPdfFilled,
}: PDFUploadSectionProps) {
	const _iframeRef = useRef<HTMLIFrameElement>(null);
	const [_isProcessing, setIsProcessing] = useState(false);

	const [
		{ files, isDragging, errors },
		{
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			openFileDialog,
			removeFile,
			getInputProps,
		},
	] = useFileUpload({
		maxSize,
		accept: "application/pdf",
		multiple: false,
		onFilesAdded: async (addedFiles) => {
			const firstFile = addedFiles[0]?.file;
			if (!firstFile) {
				return;
			}
			if (!(firstFile instanceof File)) {
				return;
			}
			const file = firstFile;

			setIsProcessing(true);
			try {
				const {
					inputTags,
					fieldMapping: mapping,
					fields,
				} = await parsePDFFormFields(file);
				if (inputTags.length === 0) {
					toast.error(
						"No form fields found in this PDF. Please upload a PDF with fillable form fields.",
					);
					removeFile(addedFiles[0].id);
					return;
				}
				onFileUpload(file, inputTags, mapping, fields);
				toast.success(`Found ${inputTags.length} form fields`);
			} catch (error) {
				console.error("Error parsing PDF:", error);
				toast.error("Failed to parse PDF form fields");
				removeFile(addedFiles[0].id);
			} finally {
				setIsProcessing(false);
			}
		},
	});

	const file = files[0];

	// Annotate PDF form fields with current labels

	const handleDownload = () => {
		if (!filledPdfUrl) {
			return;
		}
		const link = document.createElement("a");
		link.href = filledPdfUrl;
		link.download = `filled_${pdfFile?.name || "document.pdf"}`;
		link.click();
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (filledPdfUrl) {
				URL.revokeObjectURL(filledPdfUrl);
			}
		};
	}, [filledPdfUrl]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-lg">PDF Preview</h3>
					{pdfFile && (
						<p className="text-muted-foreground text-sm">{pdfFile.name}</p>
					)}
				</div>
				{filledPdfUrl && (
					<Button onClick={handleDownload} size="sm" type="button">
						<Download aria-hidden="true" className="mr-2 h-4 w-4" />
						Download
					</Button>
				)}
			</div>

			<div className="flex flex-col gap-2">
				{/* Drop area */}
				<button
					className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border border-input border-dashed p-4 transition-colors hover:bg-accent/50 has-disabled:pointer-events-none has-[input:focus]:border-ring has-disabled:opacity-50 has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
					data-dragging={isDragging || undefined}
					disabled={Boolean(file)}
					onClick={openFileDialog}
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					type="button"
				>
					<input
						{...getInputProps()}
						aria-label="Upload file"
						className="sr-only"
						disabled={Boolean(file)}
					/>

					<div className="flex flex-col items-center justify-center text-center">
						<div
							aria-hidden="true"
							className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
						>
							<UploadIcon className="size-4 opacity-60" />
						</div>
						<p className="mb-1.5 font-medium text-sm">Upload file</p>
						<p className="text-muted-foreground text-xs">
							Drag & drop or click to browse (max. {formatBytes(maxSize)})
						</p>
					</div>
				</button>

				{errors.length > 0 && (
					<div
						className="flex items-center gap-1 text-destructive text-xs"
						role="alert"
					>
						<AlertCircleIcon className="size-3 shrink-0" />
						<span>{errors[0]}</span>
					</div>
				)}

				{/* File list */}
				{file && (
					<div className="space-y-2">
						<div
							className="flex items-center justify-between gap-2 rounded-xl border px-4 py-2"
							key={file.id}
						>
							<div className="flex items-center gap-3 overflow-hidden">
								<PaperclipIcon
									aria-hidden="true"
									className="size-4 shrink-0 opacity-60"
								/>
								<div className="min-w-0">
									<p className="truncate font-medium text-[13px]">
										{file.file.name}
									</p>
								</div>
							</div>

							<Button
								aria-label="Remove file"
								className="-me-2 size-8 text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
								onClick={() => removeFile(files[0]?.id)}
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
}
