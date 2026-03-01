"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Copy,
	Download,
	Loader2,
	Mic,
	Printer,
	ScanText,
	Square,
	X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pdfjs } from "react-pdf";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import type { AudioFile, InputField } from "@/orpc/scribe/types";
import { fillPDFForm } from "../_lib/fillPDFForm";
import {
	convertPDFFieldsToInputTags,
	type FieldMapping,
	type PDFField,
	parsePDFFormFields,
} from "../_lib/parsePDFFormFields";
import { MAX_PDF_UPLOAD_BYTES } from "../_lib/pdfData";
import PDFDebugPanel from "./PDFDebugPanel";
import PDFInputs, { type InputSource } from "./PDFInputs";
import PDFUploadSection from "./PDFUploadSection";

const PDFViewSection = dynamic(() => import("./PDFViewSection"), {
	ssr: false,
});

// PDFViewSection sets pdfjs.GlobalWorkerOptions.workerSrc when it first mounts.
// It is always in the DOM (TabsContent keeps it mounted), so the worker is ready
// before any user action can trigger convertPdfToImages below.

/**
 * Renders PDF pages to JPEG canvas images using the shared pdfjs instance from react-pdf.
 * Used for openai-compatible (Ollama) connections that accept images but not raw PDFs.
 */
async function convertPdfToImages(
	pdfBytes: Uint8Array,
	maxPages = 10,
): Promise<string[]> {
	const pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
	const images: string[] = [];
	const pageCount = Math.min(pdf.numPages, maxPages);

	for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
		const page = await pdf.getPage(pageNum);
		const viewport = page.getViewport({ scale: 1.5 });

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas context nicht verfügbar");

		canvas.width = viewport.width;
		canvas.height = viewport.height;
		await page.render({ canvas, canvasContext: ctx, viewport }).promise;

		const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
		images.push(base64);
		page.cleanup();
	}

	return images;
}

function encodeUint8ArrayToBase64(data: Uint8Array): string {
	const chunkSize = 8192;
	const chunks: string[] = [];
	for (let i = 0; i < data.length; i += chunkSize) {
		const chunk = data.subarray(i, i + chunkSize);
		chunks.push(String.fromCharCode(...chunk));
	}
	return btoa(chunks.join(""));
}

async function blobToBase64(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return encodeUint8ArrayToBase64(bytes);
}

function isLikelyOcrCapableModel(model: {
	id: string;
	modelId?: string;
	providerId?: string;
	providerProtocol?: string;
	connectionProtocol?: string;
	capabilities: { supportsImage: boolean };
}): boolean {
	if (model.capabilities.supportsImage) {
		return true;
	}

	const modelId = (model.modelId ?? model.id).toLowerCase();
	return (
		modelId.includes("gemini") ||
		modelId.includes("claude") ||
		modelId.includes("gpt-4o") ||
		modelId.includes("gpt-4.1") ||
		modelId.includes("ocr") ||
		modelId.includes("vision") ||
		modelId.includes("vlm") ||
		modelId.includes("llava") ||
		modelId.includes("moondream") ||
		modelId.includes("-vl")
	);
}

interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
}

export default function PDFFormSection() {
	const [pdfFile, setPdfFile] = useState<Uint8Array | null>(null);
	const [fieldMapping, setFieldMapping] = useState<FieldMapping[]>([]);
	const [fields, setFields] = useState<PDFField[]>([]);
	const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
	const [filledPdf, setFilledPdf] = useState<Uint8Array | null>(null);
	const [pdfVersion, setPdfVersion] = useState(0);
	const [fieldSources, setFieldSources] = useState<Record<string, InputSource>>(
		{},
	);
	const [inputsKey, setInputsKey] = useState(0);
	const [activePreviewTab, setActivePreviewTab] = useState<"pdf" | "markdown">(
		"pdf",
	);
	const [ocrMarkdown, setOcrMarkdown] = useState("");
	const [selectedOcrModelId, setSelectedOcrModelId] = useState("");

	// Audio recording state
	const [isRecording, setIsRecording] = useState(false);
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);
	const maxRecordings = 3;

	const {
		data: connectorModels = [],
		isLoading: isLoadingConnectorModels,
		error: connectorModelsError,
	} = useQuery(orpc.admin.models.list.queryOptions());

	const ocrCapableModels = useMemo(
		() => connectorModels.filter(isLikelyOcrCapableModel),
		[connectorModels],
	);

	const preferredOcrModel = useMemo(() => {
		return (
			ocrCapableModels.find((model) => model.capabilities.supportsImage) ??
			ocrCapableModels.find(
				(model) =>
					model.id.toLowerCase().includes("gemini") ||
					model.id.toLowerCase().includes("claude"),
			) ??
			ocrCapableModels[0]
		);
	}, [ocrCapableModels]);

	useEffect(() => {
		if (ocrCapableModels.length === 0) {
			setSelectedOcrModelId("");
			return;
		}
		setSelectedOcrModelId((previous) => {
			if (ocrCapableModels.some((model) => model.id === previous)) {
				return previous;
			}
			return preferredOcrModel?.id ?? "";
		});
	}, [ocrCapableModels, preferredOcrModel]);

	const selectedOcrModel = useMemo(
		() => ocrCapableModels.find((model) => model.id === selectedOcrModelId),
		[ocrCapableModels, selectedOcrModelId],
	);

	// Use oRPC mutation for AI enhancement
	const enhanceMutation = useMutation(
		orpc.documents.parseForm.mutationOptions({
			onSuccess: (data) => {
				setFieldMapping(data.fieldMapping);
				toast.success("Eingaben mit KI verbessert", { id: "enhance-ai" });
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Unbekannter Fehler aufgetreten";
				toast.error(
					`Eingaben konnten nicht verbessert werden: ${errorMessage}`,
					{ id: "enhance-ai" },
				);
			},
		}),
	);

	// Voice fill mutation
	const voiceFillMutation = useMutation(
		orpc.scribe.voiceFill.mutationOptions({
			onSuccess: (data) => {
				// Update field values with AI-filled values
				setFieldValues((prev) => ({ ...prev, ...data.fieldValues }));
				// Mark all filled fields as AI-sourced
				const newSources: Record<string, InputSource> = {};
				for (const [key, value] of Object.entries(data.fieldValues)) {
					if (value) {
						newSources[key] = "ai";
					}
				}
				setFieldSources((prev) => ({ ...prev, ...newSources }));
				// Force re-render of inputs to show new values
				setInputsKey((prev) => prev + 1);
				// Clear audio recordings after successful fill
				setAudioRecordings([]);
				toast.success("Felder mit Spracheingabe ausgefüllt", {
					id: "voice-fill",
				});
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Unbekannter Fehler aufgetreten";
				toast.error(`Sprachausfüllung fehlgeschlagen: ${errorMessage}`, {
					id: "voice-fill",
				});
			},
		}),
	);

	const ocrToMarkdownMutation = useMutation(
		orpc.documents.ocrToMarkdown.mutationOptions({
			onSuccess: (data) => {
				setOcrMarkdown(data.markdown);
				setActivePreviewTab("markdown");
				toast.success("Markdown aus PDF extrahiert", {
					id: "ocr-markdown",
				});
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Unbekannter Fehler aufgetreten";
				toast.error(`OCR-Extraktion fehlgeschlagen: ${errorMessage}`, {
					id: "ocr-markdown",
				});
			},
		}),
	);

	const handleClearDocument = () => {
		setPdfFile(null);
		setFieldMapping([]);
		setFields([]);
		setFieldValues({});
		setFilledPdf(null);
		setFieldSources({});
		setAudioRecordings([]);
		setInputsKey(0);
		setOcrMarkdown("");
		setActivePreviewTab("pdf");
	};
	const { inputTags } = convertPDFFieldsToInputTags(fields, fieldMapping);
	const handleFileUpload = async (file: Uint8Array) => {
		// Keep an isolated in-memory copy for preview/fill operations.
		const stableFile = new Uint8Array(file);
		if (stableFile.byteLength > MAX_PDF_UPLOAD_BYTES) {
			toast.error("PDF ist zu groß für den Playground");
			return;
		}

		setPdfFile(stableFile);
		setOcrMarkdown("");
		setActivePreviewTab("pdf");

		// get form fields from pdf
		try {
			const { fields: parsedFields } = await parsePDFFormFields(stableFile);
			setFields(parsedFields);
			// set initial field mapping, changes with every change of fields
			setFieldMapping(
				parsedFields.map((field) => ({
					fieldName: field.name,
					label: field.name,
					description: "",
				})),
			);
		} catch (error) {
			console.error("Error parsing uploaded PDF:", error);
			setPdfFile(null);
			setFields([]);
			setFieldMapping([]);
			toast.error("PDF konnte nicht gelesen werden");
		}
	};

	const handleInputChange = useCallback((values: Record<string, unknown>) => {
		setFieldValues(values);
	}, []);

	const handleFieldEdit = useCallback((fieldName: string) => {
		setFieldSources((prev) => ({ ...prev, [fieldName]: "manual" }));
	}, []);

	const handleFillPdf = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}
		const filledPdfResult = await fillPDFForm(
			pdfFile,
			fieldValues,
			fieldMapping,
		);
		setFilledPdf(filledPdfResult);
		setPdfVersion((prev) => prev + 1);
		toast.success("PDF-Formular ausgefüllt");
	};

	const copyInputTagsToClipboard = () => {
		navigator.clipboard.writeText(JSON.stringify(fieldMapping, null, 2));
		toast.success("Eingabe-Tags in Zwischenablage kopiert");
	};

	const handleDownloadPdf = () => {
		if (!filledPdf) {
			toast.error("Bitte zuerst das PDF ausfüllen");
			return;
		}
		const arrayBuffer = filledPdf.buffer.slice(
			filledPdf.byteOffset,
			filledPdf.byteOffset + filledPdf.byteLength,
		) as ArrayBuffer;
		const blob = new Blob([arrayBuffer], { type: "application/pdf" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `formular-${new Date().toISOString().split("T")[0]}.pdf`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		toast.success("PDF heruntergeladen");
	};

	const handlePrintPdf = () => {
		if (!filledPdf) {
			toast.error("Bitte zuerst das PDF ausfüllen");
			return;
		}
		const arrayBuffer = filledPdf.buffer.slice(
			filledPdf.byteOffset,
			filledPdf.byteOffset + filledPdf.byteLength,
		) as ArrayBuffer;
		const blob = new Blob([arrayBuffer], { type: "application/pdf" });
		const url = URL.createObjectURL(blob);
		const printWindow = window.open(url, "_blank");
		if (printWindow) {
			printWindow.addEventListener("load", () => printWindow.print());
		}
	};

	const handleEnhanceWithAI = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}
		if (pdfFile.byteLength > MAX_PDF_UPLOAD_BYTES) {
			toast.error("PDF ist zu groß für KI-Verarbeitung");
			return;
		}

		const base64 = encodeUint8ArrayToBase64(pdfFile);

		toast.loading("Eingaben werden mit KI verbessert...", {
			id: "enhance-ai",
		});

		enhanceMutation.mutate({
			fileBase64: base64,
			fieldMapping,
		});
	};

	const handleExtractMarkdown = async () => {
		if (!pdfFile) {
			toast.error("Keine PDF-Datei ausgewählt");
			return;
		}
		if (pdfFile.byteLength > MAX_PDF_UPLOAD_BYTES) {
			toast.error("PDF ist zu groß für OCR-Verarbeitung");
			return;
		}

		if (ocrCapableModels.length === 0) {
			toast.error("Keine OCR-fähigen Modelle in den Verbindungen gefunden");
			return;
		}

		if (!selectedOcrModel) {
			toast.error("Bitte OCR-Modell auswählen");
			return;
		}

		const providerId =
			selectedOcrModel.providerId ?? selectedOcrModel.connectionId;
		if (!providerId) {
			toast.error("Das ausgewählte Modell hat keine gültige Verbindung");
			return;
		}

		toast.loading("Markdown wird aus PDF extrahiert...", {
			id: "ocr-markdown",
		});

		// Ollama / openai-compatible models accept images, not raw PDFs.
		// Convert PDF pages to JPEG images client-side before sending.
		if (
			(selectedOcrModel.providerProtocol ??
				selectedOcrModel.connectionProtocol) === "openai-compatible"
		) {
			try {
				const images = await convertPdfToImages(pdfFile);
				ocrToMarkdownMutation.mutate({
					imagesBase64: images,
					model: selectedOcrModel.modelId ?? selectedOcrModel.id,
					providerId,
				});
			} catch (error) {
				toast.error("PDF konnte nicht in Bilder konvertiert werden", {
					id: "ocr-markdown",
				});
				console.error("PDF→image conversion failed:", error);
			}
			return;
		}

		const base64 = encodeUint8ArrayToBase64(pdfFile);
		ocrToMarkdownMutation.mutate({
			fileBase64: base64,
			model: selectedOcrModel.modelId ?? selectedOcrModel.id,
			providerId,
		});
	};

	const handleCopyMarkdown = async () => {
		if (!ocrMarkdown) return;
		await navigator.clipboard.writeText(ocrMarkdown);
		toast.success("Markdown kopiert");
	};

	// Audio recording handlers
	const canRecord = audioRecordings.length < maxRecordings;

	const handleStartRecording = async () => {
		if (!canRecord) {
			toast.error(`Maximal ${maxRecordings} Aufnahmen möglich`);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			recordingStartTimeRef.current = Date.now();

			mediaRecorder.addEventListener("dataavailable", (event) => {
				audioChunksRef.current.push(event.data);
			});

			mediaRecorder.addEventListener("stop", () => {
				const audioBlob = new Blob(audioChunksRef.current, {
					type: "audio/wav",
				});
				const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
				const newRecording: AudioRecording = {
					blob: audioBlob,
					duration,
					id: `audio-${Date.now()}`,
				};
				setAudioRecordings((prev) => [...prev, newRecording]);
				for (const track of stream.getTracks()) {
					track.stop();
				}
			});

			mediaRecorder.start();
			setIsRecording(true);
			toast.success("Aufnahme gestartet");
		} catch (error) {
			console.error("Error starting recording:", error);
			toast.error("Fehler beim Starten der Aufnahme");
		}
	};

	const handleStopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
			toast.success("Aufnahme beendet");
		}
	};

	const handleToggleRecording = () => {
		if (isRecording) {
			handleStopRecording();
		} else {
			handleStartRecording();
		}
	};

	const handleRemoveRecording = (id: string) => {
		setAudioRecordings((prev) =>
			prev.filter((recording) => recording.id !== id),
		);
	};

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const handleVoiceFill = async () => {
		if (audioRecordings.length === 0) {
			toast.error("Bitte zuerst Audio aufnehmen");
			return;
		}

		if (fieldMapping.length === 0) {
			toast.error("Keine Formularfelder verfügbar");
			return;
		}

		toast.loading("Felder werden mit Spracheingabe ausgefüllt...", {
			id: "voice-fill",
		});

			// Convert audio blobs to base64
			const audioFiles: AudioFile[] = await Promise.all(
				audioRecordings.map(async (rec) => {
					const base64 = await blobToBase64(rec.blob);
					return { data: base64, mimeType: rec.blob.type };
				}),
			);

		const inputFields: InputField[] = fieldMapping.map((field) => ({
			label: field.label,
			description: field.description,
		}));
		voiceFillMutation.mutate({ inputFields, audioFiles });
	};

	return (
		<>
			<Card className="grid h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] grid-cols-3 gap-4 overflow-hidden">
				<div
					className="hidden overflow-y-auto overscroll-none p-4 md:block"
					key="Inputs"
				>
					<div className="mb-4 flex flex-col gap-2">
						<Button onClick={handleFillPdf}>PDF ausfüllen</Button>
						<Button
							onClick={handleDownloadPdf}
							disabled={!filledPdf}
							variant="outline"
						>
							<Download className="mr-2 h-4 w-4" />
							Herunterladen
						</Button>
						<Button
							onClick={handlePrintPdf}
							disabled={!filledPdf}
							variant="outline"
						>
							<Printer className="mr-2 h-4 w-4" />
							Drucken
						</Button>
						<Button
							onClick={handleEnhanceWithAI}
							disabled={!pdfFile}
							variant="outline"
						>
							Eingaben mit KI verbessern
						</Button>
						<Button onClick={copyInputTagsToClipboard} variant="outline">
							Eingabe-Tags in Zwischenablage kopieren
						</Button>
					</div>

					{/* Voice Input Section */}
					{pdfFile && fieldMapping.length > 0 && (
						<div className="mb-4 rounded-lg border border-solarized-blue/20 bg-solarized-blue/5 p-4">
							<div className="mb-3 flex items-center justify-between">
								<h3 className="font-medium text-sm">Sprachausfüllung</h3>
								<Button
									className={isRecording ? "bg-solarized-red" : ""}
									disabled={!(canRecord || isRecording)}
									onClick={handleToggleRecording}
									size="sm"
									title={
										canRecord || isRecording
											? isRecording
												? "Aufnahme stoppen"
												: "Audioaufnahme starten"
											: `Maximal ${maxRecordings} Aufnahmen möglich`
									}
									variant={isRecording ? "default" : "outline"}
								>
									{isRecording ? (
										<>
											<Square className="mr-2 h-4 w-4" />
											Stoppen
										</>
									) : (
										<>
											<Mic className="mr-2 h-4 w-4" />
											Aufnahme
										</>
									)}
								</Button>
							</div>

							{/* Audio Recordings List */}
							{audioRecordings.length > 0 && (
								<div className="mb-3 space-y-2">
									{audioRecordings.map((recording, index) => (
										<div
											className="flex items-center justify-between rounded-md border border-solarized-green/30 bg-solarized-green/10 px-3 py-2"
											key={recording.id}
										>
											<div className="flex items-center gap-2 text-sm text-solarized-green">
												<Mic className="h-4 w-4" />
												<span>
													Aufnahme {index + 1} (
													{formatDuration(recording.duration)})
												</span>
											</div>
											<Button
												onClick={() => handleRemoveRecording(recording.id)}
												size="sm"
												variant="ghost"
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}

							{/* Voice Fill Button */}
							<Button
								className="w-full"
								disabled={
									audioRecordings.length === 0 || voiceFillMutation.isPending
								}
								onClick={handleVoiceFill}
								variant="default"
							>
								{voiceFillMutation.isPending ? (
									"Wird ausgefüllt..."
								) : (
									<>
										<Mic className="mr-2 h-4 w-4" />
										Mit Sprache ausfüllen
									</>
								)}
							</Button>
						</div>
					)}

					<PDFInputs
						key={`inputs-${inputsKey}`}
						inputTags={inputTags}
						fieldSources={fieldSources}
						initialValues={fieldValues}
						onChange={handleInputChange}
						onFieldEdit={handleFieldEdit}
					/>
				</div>
				<div
					className="col-span-3 flex flex-col overflow-y-auto overscroll-none border-l p-4 md:col-span-2"
					key="Preview"
				>
					<PDFUploadSection
						onFileUpload={handleFileUpload}
						onClear={handleClearDocument}
						pdfFile={pdfFile}
					/>
					<div className="mt-4 min-h-0 flex-1">
						<Tabs
							className="flex h-full min-h-0 flex-col"
							value={activePreviewTab}
							onValueChange={(value) =>
								setActivePreviewTab(value as "pdf" | "markdown")
							}
						>
							<TabsList className="w-fit">
								<TabsTrigger value="pdf">PDF Vorschau</TabsTrigger>
								<TabsTrigger value="markdown">Markdown (OCR)</TabsTrigger>
							</TabsList>
							<TabsContent
								value="pdf"
								className="mt-3 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
							>
								<PDFViewSection
									key={`pdf-view-${pdfVersion}`}
									pdfFile={filledPdf ?? pdfFile}
									hasUploadedFile={Boolean(pdfFile)}
								/>
							</TabsContent>
							<TabsContent
								value="markdown"
								className="mt-3 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
							>
								<Card className="flex h-full min-h-0 flex-col border-solarized-base2">
									<CardHeader className="space-y-3 border-b border-solarized-base2 px-4 py-3">
										<div className="space-y-1">
											<CardTitle className="text-sm text-solarized-base00">
												OCR Markdown
											</CardTitle>
											<p className="text-xs text-solarized-base01">
												Wähle ein Modell aus den konfigurierten Verbindungen und
												extrahiere den Dokumenttext als Markdown.
											</p>
										</div>
										<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
											<div className="space-y-2">
												<Label className="text-sm text-solarized-base01">
													OCR-Modell
												</Label>
												<Select
													value={selectedOcrModelId}
													onValueChange={setSelectedOcrModelId}
													disabled={
														isLoadingConnectorModels ||
														ocrCapableModels.length === 0
													}
												>
													<SelectTrigger className="border-solarized-base2 bg-solarized-base3">
														<SelectValue
															placeholder={
																isLoadingConnectorModels
																	? "Modelle werden geladen..."
																	: "Modell auswählen"
															}
														/>
													</SelectTrigger>
													<SelectContent>
														{ocrCapableModels.map((model) => (
															<SelectItem key={model.id} value={model.id}>
																{model.name} (
																{model.providerProtocol ??
																	model.connectionProtocol}
																)
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												{!isLoadingConnectorModels &&
												!connectorModelsError &&
												ocrCapableModels.length === 0 ? (
													<p className="text-xs text-solarized-red">
														Keine OCR-fähigen Modelle gefunden. Aktiviere ein
														multimodales Modell in den Connector-Einstellungen.
													</p>
												) : null}
												{connectorModelsError ? (
													<p className="text-xs text-solarized-red">
														Fehler beim Laden der Modelle:{" "}
														{connectorModelsError instanceof Error
															? connectorModelsError.message
															: "Unbekannter Fehler"}
													</p>
												) : null}
											</div>
											<div className="flex flex-col gap-2 xl:justify-end">
												<Button
													onClick={handleExtractMarkdown}
													disabled={
														!pdfFile ||
														!selectedOcrModel ||
														ocrToMarkdownMutation.isPending
													}
												>
													{ocrToMarkdownMutation.isPending ? (
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Extrahiere...
														</>
													) : (
														<>
															<ScanText className="mr-2 h-4 w-4" />
															Markdown extrahieren
														</>
													)}
												</Button>
												<Button
													onClick={handleCopyMarkdown}
													variant="outline"
													disabled={!ocrMarkdown}
												>
													<Copy className="mr-2 h-4 w-4" />
													Kopieren
												</Button>
											</div>
										</div>
									</CardHeader>
									<CardContent className="min-h-0 flex-1 p-3">
										<div className="h-full overflow-y-auto rounded-md border border-solarized-base2 bg-solarized-base3 p-3">
											<pre className="whitespace-pre-wrap font-mono text-sm text-solarized-base00">
												{ocrMarkdown ||
													"Noch kein OCR-Markdown vorhanden. Lade ein PDF hoch, wähle ein Modell und starte die Extraktion."}
											</pre>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMapping} />
		</>
	);
}
