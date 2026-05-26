"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { FileDropzone } from "@repo/design-system/components/ui/file-dropzone";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronDown, FileText, Mic, Paperclip, Square, X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export interface FillInputsAudioFile {
	data: string;
	mimeType: string;
}

export interface FillInputsContextFile {
	data: string;
	mimeType: string;
	name: string;
	size: number;
}

export interface FillInputsTextContext {
	anamnese?: string;
	befunde?: string;
	diagnoseblock?: string;
	notes?: string;
}

interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
}

interface UploadedContextFile {
	file: File;
	id: string;
}

type FillInputsTextContextKey = keyof FillInputsTextContext;
type FillInputPanel = "audio" | "files" | "text";

interface FillInputControlsProps {
	className?: string;
	maxRecordings?: number;
	onSubmit: (
		audioFiles: FillInputsAudioFile[],
		textContext: FillInputsTextContext,
		contextFiles: FillInputsContextFile[],
	) => Promise<void>;
	pendingLabel?: string;
	submitLabel?: string;
	textPanelPortalTarget?: HTMLElement | null;
	title?: string;
}

const TEXT_CONTEXT_FIELDS: Array<{
	description: string;
	key: FillInputsTextContextKey;
	label: string;
	placeholder: string;
}> = [
	{
		description: "Diagnosen, Vorerkrankungen und relevante Vorbefunde.",
		key: "diagnoseblock",
		label: "Diagnoseblock",
		placeholder: "Diagnoseblock eingeben...",
	},
	{
		description: "Aufnahmegrund, Vorgeschichte und relevante Anamnese.",
		key: "anamnese",
		label: "Anamnese",
		placeholder: "Anamnese eingeben...",
	},
	{
		description: "Labor, Bildgebung, Untersuchungen und Verlauf.",
		key: "befunde",
		label: "Befunde",
		placeholder: "Befunde eingeben...",
	},
	{
		description: "Epikrise, Verlauf, Therapie oder sonstige Hinweise.",
		key: "notes",
		label: "Epikrise / Notizen",
		placeholder: "Epikrise oder weitere Notizen eingeben...",
	},
];

const encodeUint8ArrayToBase64 = (data: Uint8Array): string => {
	const chunkSize = 8192;
	const chunks: string[] = [];

	for (let i = 0; i < data.length; i += chunkSize) {
		const chunk = data.subarray(i, i + chunkSize);
		chunks.push(String.fromCodePoint(...chunk));
	}

	return btoa(chunks.join(""));
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return encodeUint8ArrayToBase64(bytes);
};

const fileToContextFile = async (file: File): Promise<FillInputsContextFile> => ({
	data: await blobToBase64(file),
	mimeType: file.type || "application/octet-stream",
	name: file.name,
	size: file.size,
});

const formatDuration = (seconds: number): string => {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = Math.floor(seconds % 60);
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const getPreferredRecordingMimeType = (): string | null => {
	const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

	for (const candidate of candidates) {
		if (MediaRecorder.isTypeSupported(candidate)) {
			return candidate;
		}
	}

	return null;
};

const hasTextValue = (value: string | undefined): boolean =>
	Boolean(value?.trim());

const getTextContextFieldCount = (textContext: FillInputsTextContext): number =>
	TEXT_CONTEXT_FIELDS.filter((field) => hasTextValue(textContext[field.key]))
		.length;

const toSubmittedTextContext = (
	textContext: FillInputsTextContext,
): FillInputsTextContext => {
	const submittedTextContext: FillInputsTextContext = {};

	for (const field of TEXT_CONTEXT_FIELDS) {
		const value = textContext[field.key]?.trim();
		if (value) {
			submittedTextContext[field.key] = value;
		}
	}

	return submittedTextContext;
};

export const FillInputControls = ({
	className,
	maxRecordings = 3,
	onSubmit,
	pendingLabel = "Wird ausgefüllt...",
	submitLabel = "Füllen",
	textPanelPortalTarget,
	title,
}: FillInputControlsProps) => {
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const [contextFiles, setContextFiles] = useState<UploadedContextFile[]>([]);
	const [openPanel, setOpenPanel] = useState<FillInputPanel | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [textContext, setTextContext] = useState<FillInputsTextContext>({});
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingStartTimeRef = useRef<number>(0);

	const canRecord = audioRecordings.length < maxRecordings;
	const textContextFieldCount = getTextContextFieldCount(textContext);
	const hasTextContext = textContextFieldCount > 0;
	const hasAudioRecordings = audioRecordings.length > 0;
	const hasContextFiles = contextFiles.length > 0;
	const canSubmit = hasAudioRecordings || hasTextContext || hasContextFiles;

	const handleStartRecording = useCallback(async () => {
		if (!canRecord) {
			toast.error(`Maximal ${maxRecordings} Aufnahmen möglich`);
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const preferredMimeType = getPreferredRecordingMimeType();
			const mediaRecorder = preferredMimeType
				? new MediaRecorder(stream, { mimeType: preferredMimeType })
				: new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			recordingStartTimeRef.current = Date.now();

			mediaRecorder.addEventListener("dataavailable", (event) => {
				audioChunksRef.current.push(event.data);
			});

			mediaRecorder.addEventListener("stop", () => {
				const firstChunkWithMimeType = audioChunksRef.current.find(
					(chunk) => chunk.type.length > 0,
				);
				const recordingMimeType =
					firstChunkWithMimeType?.type || mediaRecorder.mimeType || "audio/webm";
				const audioBlob = new Blob(audioChunksRef.current, {
					type: recordingMimeType,
				});
				const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
				setAudioRecordings((prev) => [
					...prev,
					{
						blob: audioBlob,
						duration,
						id: `audio-${Date.now()}`,
					},
				]);

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
	}, [canRecord, maxRecordings]);

	const handleStopRecording = useCallback(() => {
		if (!mediaRecorderRef.current || !isRecording) {
			return;
		}

		mediaRecorderRef.current.stop();
		setIsRecording(false);
		toast.success("Aufnahme beendet");
	}, [isRecording]);

	const handleToggleRecording = useCallback(async () => {
		if (isRecording) {
			handleStopRecording();
			return;
		}

		try {
			await handleStartRecording();
		} catch (error) {
			console.error("Error starting recording:", error);
		}
	}, [handleStartRecording, handleStopRecording, isRecording]);

	const handleRemoveRecording = useCallback((id: string) => {
		setAudioRecordings((prev) =>
			prev.filter((recording) => recording.id !== id),
		);
	}, []);

	const handleRemoveRecordingById = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const recording of audioRecordings) {
			handlers[recording.id] = () => {
				handleRemoveRecording(recording.id);
			};
		}
		return handlers;
	}, [audioRecordings, handleRemoveRecording]);

	const handleTextContextChange = useCallback(
		(key: FillInputsTextContextKey, value: string) => {
			setTextContext((prev) => ({
				...prev,
				[key]: value,
			}));
		},
		[],
	);

	const handlePanelToggle = useCallback((panel: FillInputPanel) => {
		setOpenPanel((prev) => (prev === panel ? null : panel));
	}, []);

	const handlePanelClose = useCallback(() => {
		setOpenPanel(null);
	}, []);

	const handleAddFiles = useCallback((files: { file: unknown }[]) => {
		const nextFiles = files
			.map(({ file }) => file)
			.filter((file): file is File => file instanceof File);
		if (nextFiles.length === 0) {
			return;
		}

		setContextFiles((prev) => [
			...prev,
			...nextFiles.map((file) => ({
				file,
				id: `file-${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
			})),
		]);
	}, []);

	const handleRemoveFile = useCallback((id: string) => {
		setContextFiles((prev) => prev.filter((contextFile) => contextFile.id !== id));
	}, []);

	const handleRemoveFileById = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const contextFile of contextFiles) {
			handlers[contextFile.id] = () => {
				handleRemoveFile(contextFile.id);
			};
		}
		return handlers;
	}, [contextFiles, handleRemoveFile]);

	const handleSubmit = useCallback(async () => {
		const submittedTextContext = toSubmittedTextContext(textContext);
		const hasSubmittedTextContext =
			getTextContextFieldCount(submittedTextContext) > 0;

		if (audioRecordings.length === 0 && !hasSubmittedTextContext && contextFiles.length === 0) {
			toast.error("Bitte zuerst Audio aufnehmen, Text eingeben oder Dateien hinzufügen");
			return;
		}

		setIsSubmitting(true);

		try {
			const audioFiles = await Promise.all(
				audioRecordings.map(async (recording) => ({
					data: await blobToBase64(recording.blob),
					mimeType: recording.blob.type,
				})),
			);
			const submittedContextFiles = await Promise.all(
				contextFiles.map(({ file }) => fileToContextFile(file)),
			);

			await onSubmit(audioFiles, submittedTextContext, submittedContextFiles);
		} catch {
			// Preserve context so the user can inspect or retry.
		} finally {
			setIsSubmitting(false);
		}
	}, [audioRecordings, contextFiles, onSubmit, textContext]);

	const handleTextAreaKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			if (canSubmit && !isSubmitting) {
				void handleSubmit();
			}
		},
		[canSubmit, handleSubmit, isSubmitting],
	);

	const recordingButtonTitle = (() => {
		if (!canRecord && !isRecording) {
			return `Maximal ${maxRecordings} Aufnahmen möglich`;
		}
		if (isRecording) {
			return "Aufnahme stoppen";
		}
		return "Audioaufnahme starten";
	})();

	const renderPanelShell = (
		panelTitle: string,
		panelDescription: string,
		children: ReactNode,
	) => (
		<div
			className={cn(
				"z-20 bg-solarized-blue/10 p-4 shadow-lg backdrop-blur",
				textPanelPortalTarget
					? "absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-none"
					: "absolute right-4 bottom-full left-4 mb-2 max-h-96 overflow-y-auto rounded-lg",
			)}
		>
			<div className="mb-4 flex items-center justify-between gap-2">
				<div className="min-w-0">
					<div className="font-medium text-foreground text-sm">
						{panelTitle}
					</div>
					<div className="text-muted-foreground text-xs">
						{panelDescription}
					</div>
				</div>
				<Button
					aria-label={`${panelTitle} minimieren`}
					onClick={handlePanelClose}
					size="icon"
					type="button"
					variant="ghost"
				>
					<ChevronDown className="h-4 w-4" />
				</Button>
			</div>
			{children}
		</div>
	);

	const textPanel = renderPanelShell(
		"Textkontext",
		"Hier kannst du Text z.B. aus dem aktuellen Arztbrief einfügen, um eine Vorlage zu füllen",
		<div
			className={cn(
				"grid min-h-0 gap-4 md:grid-cols-2",
				textPanelPortalTarget ? "flex-1 auto-rows-fr" : "",
			)}
		>
			{TEXT_CONTEXT_FIELDS.map((field) => (
				<label
					className={cn(
						"min-w-0 space-y-1.5",
						textPanelPortalTarget ? "flex min-h-0 flex-col" : "",
					)}
					key={field.key}
				>
					<span className="font-medium text-foreground text-xs">
						{field.label}
					</span>
					<Textarea
						className={cn(
							"resize-y bg-background text-xs placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue/20",
							textPanelPortalTarget ? "min-h-0 flex-1 resize-none" : "min-h-24",
						)}
						onChange={(event) => {
							handleTextContextChange(field.key, event.target.value);
						}}
						onKeyDown={handleTextAreaKeyDown}
						placeholder={field.placeholder}
						value={textContext[field.key] ?? ""}
					/>
					<span className="block text-muted-foreground text-[11px]">
						{field.description}
					</span>
				</label>
			))}
		</div>,
	);

	const audioPanel = renderPanelShell(
		"Audio",
		"Nimm Audio auf und verwalte die Aufnahmen, die beim Füllen berücksichtigt werden.",
		<div className="flex min-h-0 flex-col gap-4">
			<Button
				className={cn("w-fit", isRecording ? "bg-solarized-red text-white" : "")}
				disabled={!(canRecord || isRecording)}
				onClick={handleToggleRecording}
				type="button"
				variant={isRecording ? "default" : "outline"}
			>
				{isRecording ? (
					<Square className="mr-2 h-4 w-4" />
				) : (
					<Mic className="mr-2 h-4 w-4" />
				)}
				{recordingButtonTitle}
			</Button>
			<div className="grid gap-2 overflow-y-auto">
				{audioRecordings.length > 0 ? (
					audioRecordings.map((recording, index) => (
						<div
							className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-solarized-green/30 bg-solarized-green/10 px-2 py-1.5"
							key={recording.id}
						>
							<div className="flex min-w-0 items-center gap-2 text-solarized-green text-xs">
								<Mic className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">
									Aufnahme {index + 1} · {formatDuration(recording.duration)}
								</span>
							</div>
							<Button
								aria-label="Aufnahme entfernen"
								className="h-7 w-7 shrink-0"
								onClick={handleRemoveRecordingById[recording.id]}
								size="icon"
								type="button"
								variant="ghost"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))
				) : (
					<div className="rounded-md border border-dashed bg-background/60 p-4 text-muted-foreground text-xs">
						Noch keine Audioaufnahme vorhanden.
					</div>
				)}
			</div>
		</div>,
	);

	const filePanel = renderPanelShell(
		"Dateien",
		"Füge Dateien als Kontext hinzu und entferne sie wieder, bevor du die Vorlage füllst.",
		<div className="flex min-h-0 flex-col gap-4">
			<FileDropzone
				className="hover:border-solarized-blue data-[dragging=true]:border-solarized-blue data-[dragging=true]:bg-solarized-blue/10"
				multiple
				onFilesAdded={handleAddFiles}
				title="Dateien hier ablegen oder auswählen"
				variant="compact"
			/>
			<div
				className="grid gap-2 overflow-y-auto"
			>
				{contextFiles.length > 0 ? (
					contextFiles.map(({ file, id }) => (
						<div
							className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5"
							key={id}
						>
							<div className="flex min-w-0 items-center gap-2 text-xs">
								<Paperclip className="h-3.5 w-3.5 shrink-0 text-solarized-blue" />
								<span className="truncate">{file.name}</span>
								<span className="shrink-0 text-muted-foreground">
									{Math.ceil(file.size / 1024)} KB
								</span>
							</div>
							<Button
								aria-label="Datei entfernen"
								className="h-7 w-7 shrink-0"
								onClick={handleRemoveFileById[id]}
								size="icon"
								type="button"
								variant="ghost"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					))
				) : (
					<div className="rounded-md border border-dashed bg-background p-4 text-muted-foreground text-xs">
						Noch keine Datei hinzugefügt.
					</div>
				)}
			</div>
		</div>,
	);

	const activePanel =
		openPanel === "text" ? textPanel : openPanel === "audio" ? audioPanel : openPanel === "files" ? filePanel : null;

	return (
		<div className={cn("relative space-y-2", className)}>
			{activePanel
				? textPanelPortalTarget
					? createPortal(activePanel, textPanelPortalTarget)
					: activePanel
				: null}

			<div className="flex min-w-0 items-center gap-2">
				{title ? (
					<div className="min-w-0 flex-1">
						<span className="truncate font-medium text-foreground text-xs">
							{title}
						</span>
					</div>
				) : null}
				<Button
					aria-expanded={openPanel === "files"}
					aria-label="Dateien hinzufügen"
					className="relative shrink-0"
					onClick={() => {
						handlePanelToggle("files");
					}}
					size="icon"
					title="Dateien hinzufügen"
					type="button"
					variant={hasContextFiles ? "secondary" : "outline"}
				>
					<Paperclip className="h-4 w-4" />
					{hasContextFiles ? (
						<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
					) : null}
				</Button>
				<Button
					aria-expanded={openPanel === "audio"}
					aria-label="Audio-Kontext öffnen"
					className="relative shrink-0"
					onClick={() => {
						handlePanelToggle("audio");
					}}
					size="icon"
					title="Audio-Kontext öffnen"
					type="button"
					variant={hasAudioRecordings || isRecording ? "secondary" : "outline"}
				>
					<Mic className="h-4 w-4" />
					{hasAudioRecordings || isRecording ? (
						<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
					) : null}
				</Button>
				<Button
					aria-expanded={openPanel === "text"}
					aria-label="Textkontext öffnen"
					className="relative shrink-0"
					onClick={() => {
						handlePanelToggle("text");
					}}
					size="icon"
					type="button"
					variant={hasTextContext ? "secondary" : "outline"}
				>
					<FileText className="h-4 w-4" />
					{hasTextContext ? (
						<span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-solarized-green" />
					) : null}
				</Button>
				<Button
					className="ml-auto h-9 shrink-0 px-3 text-xs"
					disabled={!canSubmit || isSubmitting}
					onClick={handleSubmit}
					type="button"
					variant="default"
				>
					{isSubmitting ? pendingLabel : submitLabel}
				</Button>
			</div>

		</div>
	);
};
