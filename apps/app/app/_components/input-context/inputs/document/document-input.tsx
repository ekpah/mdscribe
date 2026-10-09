"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { FileDropzone } from "@repo/design-system/components/ui/file-dropzone";
import { Label } from "@repo/design-system/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { cn } from "@repo/design-system/lib/utils";
import {
	Check,
	Eye,
	LoaderCircle,
	Paperclip,
	Redo2,
	RotateCcw,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PDFViewSection } from "@/app/_components/pdf-view-section-dynamic";
import { FILL_INPUT_PAYLOAD_LIMITS, formatPayloadBytes } from "@/lib/input-fill-limits";

import { addContextFilesToValue } from "../../files";
import type { UploadedContextFile } from "../../types";
import { MobileFileUpload } from "./mobile-file-upload";
import { OcrImagePreview, OcrTextPreview } from "./ocr-preview";
import type { QuarterTurn } from "./ocr-preview";

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
	ocrEnabled?: boolean;
	onAddFiles?: (files: File[]) => boolean | undefined;
	onRetryOcr?: (id: string) => void;
	/** Replaces an image with a rotated copy and re-runs OCR; returns the new file. */
	onRotate?: RotateFile;
	onValueChange: (files: UploadedContextFile[]) => void;
	value: UploadedContextFile[];
}

type RotateFile = (id: string, turn: QuarterTurn) => Promise<UploadedContextFile | null>;

/** Natural (EXIF-oriented) size of an image URL, for images without OCR geometry yet. */
const useImageSize = (url: string | null) => {
	const [size, setSize] = useState<{ height: number; url: string; width: number } | null>(null);
	useEffect(() => {
		if (!url) {
			return;
		}
		const image = new window.Image();
		image.addEventListener("load", () => {
			setSize({ height: image.naturalHeight, url, width: image.naturalWidth });
		});
		image.src = url;
	}, [url]);
	return size?.url === url ? size : null;
};

const ImageOriginalPreview = ({
	file,
	onRotate,
	onStartOcr,
	previewUrl,
}: {
	file: UploadedContextFile;
	onRotate?: (turn: QuarterTurn) => Promise<void>;
	onStartOcr?: () => void;
	previewUrl: string;
}) => {
	const [viewRotation, setViewRotation] = useState<QuarterTurn>(0);
	const [showRegions, setShowRegions] = useState(true);
	const [isRotating, setIsRotating] = useState(false);
	const busy = isRotating || file.ocrStatus === "pending";
	const imageSize = useImageSize(previewUrl);
	const ocrPage = file.ocrResult?.pages?.[0];
	const frame = ocrPage ?? (imageSize ? { ...imageSize, blocks: [] } : null);
	const turn = (delta: 90 | 270) => {
		setViewRotation((current) => ((current + delta) % 360) as QuarterTurn);
	};
	const resubmitRotated = async () => {
		if (viewRotation === 0) {
			onStartOcr?.();
			return;
		}
		if (!onRotate) {
			return;
		}
		setIsRotating(true);
		try {
			await onRotate(viewRotation);
			setViewRotation(0);
		} finally {
			setIsRotating(false);
		}
	};
	return (
		<div className="flex h-full min-h-96 flex-col">
			<div className="flex flex-wrap items-center gap-2 border-b p-2">
				<Button disabled={busy} onClick={() => turn(270)} size="sm" type="button" variant="outline">
					<Undo2 className="h-4 w-4" />
					Links drehen
				</Button>
				<Button disabled={busy} onClick={() => turn(90)} size="sm" type="button" variant="outline">
					<Redo2 className="h-4 w-4" />
					Rechts drehen
				</Button>
				{ocrPage?.blocks.length ? (
					<div className="flex items-center gap-2 px-2">
						<Checkbox
							checked={showRegions}
							id={`ocr-regions-${file.id}`}
							onCheckedChange={(checked) => {
								setShowRegions(checked === true);
							}}
						/>
						<Label className="font-normal text-sm" htmlFor={`ocr-regions-${file.id}`}>
							Erkannte Textstellen
						</Label>
					</div>
				) : null}
				{file.ocrStatus === "pending" ? (
					<span className="flex items-center gap-1 text-muted-foreground text-sm">
						<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
						Texterkennung läuft …
					</span>
				) : null}
				{onStartOcr || (viewRotation !== 0 && onRotate) ? (
					<div className="ml-auto flex min-w-0 max-w-full flex-wrap justify-end gap-2">
						{viewRotation === 0 ? null : (
							<Button
								disabled={busy}
								onClick={() => setViewRotation(0)}
								size="sm"
								type="button"
								variant="ghost"
							>
								Zurücksetzen
							</Button>
						)}
						<Button
							className="h-auto min-h-8 max-w-full whitespace-normal"
							disabled={busy}
							onClick={resubmitRotated}
							size="sm"
							type="button"
						>
							{isRotating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
							{file.ocrStatus === "awaiting-alignment"
								? "Ausrichtung bestätigen und OCR starten"
								: "OCR erneut starten"}
						</Button>
					</div>
				) : null}
			</div>
			{file.ocrStatus === "awaiting-alignment" ? (
				<p className="px-3 py-2 text-muted-foreground text-sm">
					Bitte das Bild vor der OCR manuell korrekt ausrichten. Es gibt keine automatische
					Dreherkennung.
				</p>
			) : null}
			<div className="min-h-0 flex-1 p-2">
				{frame ? (
					<OcrImagePreview
						alt={`Vorschau von ${file.file.name}`}
						page={frame}
						previewUrl={previewUrl}
						showRegions={showRegions}
						viewRotation={viewRotation}
					/>
				) : null}
			</div>
		</div>
	);
};

const FilePreviewDialog = ({
	file,
	ocrEnabled,
	onOpenChange,
	onRotate,
	onStartOcr,
	pdfFile,
	previewUrl,
}: {
	file: UploadedContextFile;
	ocrEnabled: boolean;
	onOpenChange: (open: boolean) => void;
	onRotate?: (turn: QuarterTurn) => Promise<void>;
	onStartOcr?: () => void;
	pdfFile: Uint8Array | null;
	previewUrl: string | null;
}) => {
	const ocrText = file.ocrResult?.text;
	const renderOriginalPreview = () => {
		if (pdfFile) {
			return <PDFViewSection hasUploadedFile pdfFile={pdfFile} resetKey={file.id} />;
		}

		if (previewUrl) {
			if (!ocrEnabled) {
				return (
					<Image
						alt={`Vorschau von ${file.file.name}`}
						className="object-contain"
						fill
						sizes="(max-width: 1024px) 100vw, 1024px"
						src={previewUrl}
						unoptimized
					/>
				);
			}
			return (
				<ImageOriginalPreview
					file={file}
					onRotate={onRotate}
					onStartOcr={onStartOcr}
					previewUrl={previewUrl}
				/>
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
						{ocrEnabled
							? "Automatische Texterkennung. Zahlen, Dosierungen und Zuordnungen am Original prüfen."
							: "Dateivorschau"}
					</DialogDescription>
				</DialogHeader>
				{ocrEnabled ? (
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
								<OcrTextPreview text={ocrText} />
							) : (
								<div className="flex h-full min-h-64 items-center justify-center p-6 text-center text-muted-foreground text-sm">
									{file.ocrStatus === "pending"
										? "OCR wird ausgeführt …"
										: (file.ocrError ?? "Kein OCR-Text verfügbar.")}
								</div>
							)}
						</TabsContent>
					</Tabs>
				) : (
					<div className="relative min-h-0 flex-1 overflow-hidden rounded-md border">
						{renderOriginalPreview()}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export const DocumentInput = ({
	accept = "application/pdf,image/*",
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
	ocrEnabled = false,
	onAddFiles,
	onRetryOcr,
	onRotate,
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

	const rotatePreviewFile = useCallback(
		async (turn: QuarterTurn) => {
			if (!(previewFile && onRotate)) {
				return;
			}
			const rotated = await onRotate(previewFile.file.id, turn);
			if (!rotated) {
				return;
			}
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
			}
			const url = URL.createObjectURL(rotated.file);
			previewUrlRef.current = url;
			setPreviewFile({ file: rotated, pdfFile: null, url });
		},
		[onRotate, previewFile],
	);

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
					file={value.find((file) => file.id === previewFile.file.id) ?? previewFile.file}
					ocrEnabled={ocrEnabled}
					onOpenChange={(open) => {
						if (!open) {
							closePreview();
						}
					}}
					onRotate={ocrEnabled && onRotate ? rotatePreviewFile : undefined}
					onStartOcr={ocrEnabled && onRetryOcr ? () => onRetryOcr(previewFile.file.id) : undefined}
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
					value.map(({ file, id, ocrError, ocrStatus }) => {
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
									{ocrEnabled && ocrStatus === "awaiting-alignment" ? (
										<span className="text-muted-foreground">Ausrichtung prüfen</span>
									) : null}
									{ocrEnabled && ocrStatus === "pending" ? (
										<LoaderCircle aria-label="OCR läuft" className="h-3.5 w-3.5 animate-spin" />
									) : null}
								</button>
								{ocrEnabled && ocrStatus === "error" && onRetryOcr ? (
									<Button
										aria-label={`OCR für ${file.name} erneut versuchen`}
										onClick={() => onRetryOcr(id)}
										size="icon"
										title={ocrError ?? "OCR erneut versuchen"}
										type="button"
										variant="ghost"
									>
										<RotateCcw className="h-4 w-4 text-destructive" />
									</Button>
								) : null}
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
