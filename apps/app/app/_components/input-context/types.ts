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

export interface InputContextFile {
	data: string;
	mimeType: string;
	name: string;
	size: number;
}

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
}

export type InputContextPanel = "audio" | "files" | "text";

export interface InputContextController {
	addAudioFiles: (files: File[]) => boolean;
	addContextFiles: (files: File[]) => boolean;
	audioRecordings: AudioRecording[];
	contextFiles: UploadedContextFile[];
	effectiveMaxRecordings: number;
	hasAnyContext: boolean;
	hasAudioRecordings: boolean;
	hasContextFiles: boolean;
	hasTextContext: boolean;
	prepareSubmission: () => Promise<InputContextSubmission>;
	setAudioRecordings: (recordings: AudioRecording[]) => void;
	setContextFiles: (files: UploadedContextFile[]) => void;
	setTextContext: (textContext: InputContextTextContext) => void;
	textContext: InputContextTextContext;
}
