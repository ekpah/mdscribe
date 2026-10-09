import type { ContextDocument, OcrResult } from "@/lib/ocr-types";

export interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
	mimeType: string;
	sourceDeviceLabel: string;
	url: string;
}

export interface InputContextAudioFile {
	data: string;
	mimeType: string;
	wavFallback?: {
		data: string;
		mimeType: "audio/wav";
	};
}

export type InputContextFile = ContextDocument;

export interface InputContextTextContext {
	anamnese?: string;
	befunde?: string;
	diagnoseblock?: string;
	epikrise?: string;
	notes?: string;
}

export type InputContextTextContextKey = keyof InputContextTextContext;

export interface InputContextSubmission {
	audioFiles: InputContextAudioFile[];
	contextFiles: InputContextFile[];
	textContext: InputContextTextContext;
}

export interface UploadedContextFile {
	file: File;
	id: string;
	ocrError?: string;
	ocrResult?: OcrResult;
	/** Images await manual alignment; "skipped" means no OCR model is configured. */
	ocrStatus?: "awaiting-alignment" | "pending" | "error" | "complete" | "skipped";
}

export type InputContextPanel = "audio" | "files" | "text";

export interface InputContextController {
	addAudioFiles: (files: File[]) => boolean;
	addContextFiles: (files: File[]) => boolean;
	audioRecordings: AudioRecording[];
	contextFiles: UploadedContextFile[];
	ocrConfigured: boolean;
	effectiveMaxRecordings: number;
	hasAnyContext: boolean;
	hasAudioRecordings: boolean;
	hasContextFiles: boolean;
	hasTextContext: boolean;
	prepareSubmission: () => Promise<InputContextSubmission>;
	retryContextFileOcr: (id: string) => void;
	/** Replaces an image with a rotated copy and re-runs OCR; returns the new file. */
	rotateContextFile: (
		id: string,
		/** Clockwise turn of the stored image (EXIF already applied). */
		turn: 0 | 90 | 180 | 270,
	) => Promise<UploadedContextFile | null>;
	setAudioRecordings: (recordings: AudioRecording[]) => void;
	setContextFiles: (files: UploadedContextFile[]) => void;
	setContextFileOcrResults: (results: OcrResult[]) => void;
	setTextContext: (textContext: InputContextTextContext) => void;
	textContext: InputContextTextContext;
}
