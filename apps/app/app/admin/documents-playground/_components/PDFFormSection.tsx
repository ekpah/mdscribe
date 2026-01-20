"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card } from "@repo/design-system/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { Download, Mic, Printer, Square, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";
import type { AudioFile, InputField } from "@/orpc/scribe/types";
import { fillPDFForm } from "../_lib/fillPDFForm";
import {
	type FieldMapping,
	type PDFField,
	convertPDFFieldsToInputTags,
	parsePDFFormFields,
} from "../_lib/parsePDFFormFields";
import PDFDebugPanel from "./PDFDebugPanel";
import PDFInputs, { type InputSource } from "./PDFInputs";
import PDFUploadSection from "./PDFUploadSection";

const PDFViewSection = dynamic(() => import("./PDFViewSection"), {
	ssr: false,
});

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

	// Audio recording state
	const [isRecording, setIsRecording] = useState(false);
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);
	const maxRecordings = 3;

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

	const handleClearDocument = () => {
		setPdfFile(null);
		setFieldMapping([]);
		setFields([]);
		setFieldValues({});
		setFilledPdf(null);
		setFieldSources({});
		setAudioRecordings([]);
		setInputsKey(0);
	};
	const { inputTags } = convertPDFFieldsToInputTags(fields, fieldMapping);
	const handleFileUpload = async (file: Uint8Array) => {
		setPdfFile(file);

		// get form fields from pdf
		const { fields } = await parsePDFFormFields(file);
		setFields(fields);
		// set initial field mapping, changes with every change of fields
		setFieldMapping(
			fields.map((field) => ({
				fieldName: field.name,
				label: field.name,
				description: "",
			})),
		);
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

		// Convert Uint8Array to base64 in chunks to avoid stack overflow for large files
		// Using array + join is more memory efficient than string concatenation
		const chunkSize = 8192;
		const chunks: string[] = [];
		for (let i = 0; i < pdfFile.length; i += chunkSize) {
			const chunk = pdfFile.subarray(i, i + chunkSize);
			chunks.push(String.fromCharCode(...chunk));
		}
		const base64 = btoa(chunks.join(""));

		toast.loading("Eingaben werden mit KI verbessert...", {
			id: "enhance-ai",
		});

		enhanceMutation.mutate({
			fileBase64: base64,
			fieldMapping,
		});
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
				const reader = new FileReader();
				const base64 = await new Promise<string>((resolve) => {
					reader.onloadend = () => {
						const result = reader.result as string;
						resolve(result.split(",")[1]);
					};
					reader.readAsDataURL(rec.blob);
				});
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
					<div className="mt-4 flex-1">
						<PDFViewSection
							key={`pdf-view-${pdfVersion}`}
							pdfFile={filledPdf ?? pdfFile}
							hasUploadedFile={Boolean(pdfFile)}
						/>
					</div>
				</div>
			</Card>
			<PDFDebugPanel values={fieldValues} fieldMapping={fieldMapping} />
		</>
	);
}
