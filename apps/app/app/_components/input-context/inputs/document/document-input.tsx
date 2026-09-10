"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { FileDropzone } from "@repo/design-system/components/ui/file-dropzone";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { cn } from "@repo/design-system/lib/utils";
import { Check, Eye, Paperclip, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PDFViewSection } from "@/app/_components/pdf-view-section-dynamic";
import { FILL_INPUT_PAYLOAD_LIMITS, formatPayloadBytes } from "@/lib/input-fill-limits";

import { addContextFilesToValue } from "../../files";
import type { UploadedContextFile } from "../../types";
import { MobileFileUpload } from "./mobile-file-upload";

interface DocumentInputProps {
	accept?: string;
	className?: string;
	disabled?: boolean;
	dropzoneClassName?: string;
	emptyClassName?: string;
	emptyLabel?: string;
	itemClassName?: string;
	listClassName?: string;
	maxFileBytes?: number;
	maxFiles?: number;
	maxTotalBytes?: number;
	onAddFiles?: (files: File[]) => boolean | undefined;
	onValueChange: (files: UploadedContextFile[]) => void;
	value: UploadedContextFile[];
}

const FilePreviewDialog = ({
	file,
	onOpenChange,
	pdfFile,
	previewUrl,
}: {
	file: UploadedContextFile;
	onOpenChange: (open: boolean) => void;
	pdfFile: Uint8Array | null;
	previewUrl: string | null;
}) => {
	const ocrText = file.ocrResult?.text;
	const renderOriginalPreview = () => {
		if (pdfFile) {
			return <PDFViewSection hasUploadedFile pdfFile={pdfFile} resetKey={file.id} />;
		}

		if (previewUrl) {
			return (
				<div className="relative h-full min-h-96 w-full">
					<Image
						alt={`Vorschau von ${file.file.name}`}
						className="object-contain"
						fill
						src={previewUrl}
						unoptimized
					/>
				</div>
			);
		}

		return (
			<div className="flex h-full min-h-96 items-center justify-center p-6 text-center text-muted-foreground text-sm">
				Für diesen Dateityp ist keine Vorschau verfügbar.
			</div>
		);
	};
	return (
		<Dialog onOpenChange={onOpenChange} open>
			<DialogContent className="flex h-[min(52rem,calc(100vh-2rem))] max-w-5xl flex-col overflow-hidden p-4 sm:max-w-5xl">
				<DialogHeader className="pr-8">
					<DialogTitle className="truncate">{file.file.name}</DialogTitle>
					<DialogDescription>
						Originaldatei und der bei der letzten Anfrage erkannte OCR-Text.
					</DialogDescription>
				</DialogHeader>
				<Tabs className="min-h-0 flex-1" defaultValue="original">
					<TabsList>
						<TabsTrigger value="original">Original</TabsTrigger>
						<TabsTrigger value="ocr">OCR-Text</TabsTrigger>
					</TabsList>
					<TabsContent
						className="h-full min-h-0 overflow-hidden rounded-md border"
						value="original"
					>
						{renderOriginalPreview()}
					</TabsContent>
					<TabsContent
						className="min-h-0 overflow-auto rounded-md border bg-muted/20 p-4"
						value="ocr"
					>
						{ocrText ? (
							<pre className="font-sans text-sm whitespace-pre-wrap">{ocrText}</pre>
						) : (
							<div className="flex h-full min-h-64 items-center justify-center p-6 text-center text-muted-foreground text-sm">
								OCR-Text ist nach dem Absenden verfügbar, sofern die Datei durch das OCR-Modell
								vorverarbeitet wurde.
							</div>
						)}
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
};

export const DocumentInput = ({
	accept,
	className,
	disabled = false,
	dropzoneClassName,
	emptyClassName,
	emptyLabel = "Noch keine Datei hinzugefügt.",
	itemClassName,
	listClassName,
	maxFileBytes = FILL_INPUT_PAYLOAD_LIMITS.maxContextFileBytes,
	maxFiles = FILL_INPUT_PAYLOAD_LIMITS.maxContextFiles,
	maxTotalBytes = FILL_INPUT_PAYLOAD_LIMITS.maxContextFilesTotalBytes,
	onAddFiles,
	onValueChange,
	value,
}: DocumentInputProps) => {
	const [confirmingDeleteFileId, setConfirmingDeleteFileId] = useState<string | null>(null);
	const [previewFile, setPreviewFile] = useState<{
		file: UploadedContextFile;
		pdfFile: Uint8Array | null;
		url: string | null;
	} | null>(null);
	const previewUrlRef = useRef<string | null>(null);

	const closePreview = useCallback(() => {
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current);
			previewUrlRef.current = null;
		}
		setPreviewFile(null);
	}, []);

	useEffect(
		() => () => {
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
			}
		},
		[],
	);

	const handleRawFiles = useCallback(
		(nextFiles: File[]) => {
			if (disabled) {
				return false;
			}

			if (nextFiles.length === 0) {
				return false;
			}

			if (onAddFiles) {
				return Boolean(onAddFiles(nextFiles));
			}

			const result = addContextFilesToValue({
				currentFiles: value,
				files: nextFiles,
				maxFileBytes,
				maxFiles,
				maxTotalBytes,
			});
			if (!result.ok) {
				if (result.message) {
					toast.error(result.message);
				}
				return false;
			}

			onValueChange(result.files);
			return true;
		},
		[disabled, maxFileBytes, maxFiles, maxTotalBytes, onAddFiles, onValueChange, value],
	);
	const handleAddFiles = useCallback(
		(files: { file: unknown }[]) => {
			handleRawFiles(
				files.map(({ file }) => file).filter((file): file is File => file instanceof File),
			);
		},
		[handleRawFiles],
	);

	const handleRemoveFile = useCallback(
		(id: string) => {
			onValueChange(value.filter((contextFile) => contextFile.id !== id));
			setConfirmingDeleteFileId(null);
		},
		[onValueChange, value],
	);

	const handleDeleteClick = useCallback(
		(id: string) => {
			if (confirmingDeleteFileId !== id) {
				setConfirmingDeleteFileId(id);
				return;
			}

			handleRemoveFile(id);
		},
		[confirmingDeleteFileId, handleRemoveFile],
	);

	useEffect(() => {
		if (
			confirmingDeleteFileId &&
			!value.some((contextFile) => contextFile.id === confirmingDeleteFileId)
		) {
			setConfirmingDeleteFileId(null);
		}
	}, [confirmingDeleteFileId, value]);

	useEffect(() => {
		if (!confirmingDeleteFileId) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setConfirmingDeleteFileId(null);
		}, 3000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [confirmingDeleteFileId]);

	return (
		<div className={cn("flex min-h-0 flex-col gap-4", disabled && "opacity-70", className)}>
			{previewFile ? (
				<FilePreviewDialog
					file={previewFile.file}
					onOpenChange={(open) => {
						if (!open) {
							closePreview();
						}
					}}
					pdfFile={previewFile.pdfFile}
					previewUrl={previewFile.url}
				/>
			) : null}
			<FileDropzone
				accept={accept}
				className={cn(
					"hover:border-solarized-blue data-[dragging=true]:border-solarized-blue data-[dragging=true]:bg-solarized-blue/10",
					disabled && "pointer-events-none",
					dropzoneClassName,
				)}
				description={`Max. ${maxFiles} Dateien, ${formatPayloadBytes(maxFileBytes)} je Datei`}
				multiple
				onFilesAdded={handleAddFiles}
				title="Dateien hier ablegen oder auswählen"
				variant="compact"
			/>
			<MobileFileUpload disabled={disabled} onFilesReceived={handleRawFiles} />
			<div className={cn("grid gap-2 overflow-y-auto", listClassName)}>
				{value.length > 0 ? (
					value.map(({ file, id }) => {
						const isConfirmingDelete = confirmingDeleteFileId === id;

						return (
							<div
								className={cn(
									"flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5",
									itemClassName,
								)}
								key={id}
							>
								<button
									className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
									onClick={async () => {
										const selectedFile = value.find((item) => item.id === id);
										if (selectedFile) {
											const isPdf = selectedFile.file.type === "application/pdf";
											const url = selectedFile.file.type.startsWith("image/")
												? URL.createObjectURL(selectedFile.file)
												: null;
											previewUrlRef.current = url;
											setPreviewFile({
												file: selectedFile,
												pdfFile: isPdf
													? new Uint8Array(await selectedFile.file.arrayBuffer())
													: null,
												url,
											});
										}
									}}
									title="Datei anzeigen"
									type="button"
								>
									<Paperclip className="h-3.5 w-3.5 shrink-0 text-solarized-blue" />
									<span className="truncate">{file.name}</span>
									<span className="shrink-0 text-muted-foreground">
										{Math.ceil(file.size / 1024)} KB
									</span>
									<Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								</button>
								<div className="flex w-16 shrink-0 items-center justify-end gap-1">
									{isConfirmingDelete ? (
										<Button
											aria-label="Löschen abbrechen"
											className="h-7 w-7"
											disabled={disabled}
											onClick={() => {
												setConfirmingDeleteFileId(null);
											}}
											size="icon"
											title="Löschen abbrechen"
											type="button"
											variant="ghost"
										>
											<X className="h-4 w-4" />
										</Button>
									) : null}
									<Button
										aria-label={isConfirmingDelete ? "Löschen bestätigen" : "Datei entfernen"}
										className={cn("h-7 w-7", isConfirmingDelete && "text-solarized-red")}
										disabled={disabled}
										onClick={() => {
											handleDeleteClick(id);
										}}
										size="icon"
										title={isConfirmingDelete ? "Löschen bestätigen" : "Datei entfernen"}
										type="button"
										variant="ghost"
									>
										{isConfirmingDelete ? (
											<Check className="h-4 w-4" />
										) : (
											<Trash2 className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
						);
					})
				) : (
					<div
						className={cn(
							"rounded-md border border-dashed bg-background p-4 text-muted-foreground text-xs",
							emptyClassName,
						)}
					>
						{emptyLabel}
					</div>
				)}
			</div>
		</div>
	);
};
