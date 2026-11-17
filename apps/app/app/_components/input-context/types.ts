import type { ContextDocument, OcrResult } from "@/lib/ocr-types";

export interface AudioRecording {
	blob: Blob;
	duration: number;
	id: string;
	mimeType: string;
	sourceDeviceLabel: string;
	/** Set once a generation has transcribed the recording, so later generations reuse it. */
	transcript?: string;
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
	/** Hintergrundinformationen from before the current presentation: a fact source that is not copied. */
	background?: string;
	/** Notizen on the current presentation, the main input. */
	notes?: string;
}

export type InputContextTextContextKey = keyof InputContextTextContext;

export interface InputContextSubmission {
	audioFiles: InputContextAudioFile[];
	contextFiles: InputContextFile[];
	/** Local file snapshots matching the submitted IDs and materialized orientation. */
	preparedContextFiles: UploadedContextFile[];
	textContext: InputContextTextContext;
}

export interface UploadedContextFile {
	file: File;
	id: string;
	/** Preview alignment to apply to the image bytes when OCR is started. */
	viewRotation?: 0 | 90 | 180 | 270;
	ocrError?: string;
	ocrResult?: OcrResult;
	/** Images await manual alignment; "skipped" means no OCR model is configured. */
	ocrStatus?: "awaiting-alignment" | "pending" | "error" | "complete" | "skipped";
}

export type InputContextPanel = "audio" | "files" | "text";

export interface InputContextController {
	addAudioFiles: (files: File[]) => boolean;
	addContextFiles: (files: File[]) => boolean;
	/** Empties text, files and recordings: a new case. */
	clear: () => void;
	audioRecordings: AudioRecording[];
	contextFiles: UploadedContextFile[];
	ocrConfigured: boolean;
	effectiveMaxRecordings: number;
	hasAnyContext: boolean;
	hasAudioRecordings: boolean;
	hasContextFiles: boolean;
	hasPendingOcr: boolean;
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
	setContextFileOcrResults: (results: OcrResult[], fileIds?: (string | undefined)[]) => void;
	setTextContext: (textContext: InputContextTextContext) => void;
	textContext: InputContextTextContext;
}
