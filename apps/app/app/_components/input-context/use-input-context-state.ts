"use client";

import {
	blobToBase64,
	createAudioSubmissionFile,
} from "@repo/design-system/components/inputs/audio-submission";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	FILL_INPUT_PAYLOAD_LIMITS,
	formatPayloadBytes,
	getBase64DecodedByteLength,
} from "@/lib/input-fill-limits";
import type { OcrResult, RawContextDocument } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";

import {
	addAudioFilesToValue,
	addContextFilesToValue,
	createUploadedContextFile,
	rotateImageFile,
} from "./files";
import {
	getTextContextCharacterCount,
	getTextContextFieldCount,
	toSubmittedTextContext,
} from "./inputs/text/text-input";
import type {
	AudioRecording,
	InputContextAudioFile,
	InputContextController,
	InputContextFile,
	InputContextSubmission,
	InputContextTextContext,
	UploadedContextFile,
} from "./types";

interface UseInputContextStateOptions {
	/** Agent panels use the agent model's document capability. */
	agent?: boolean;
	maxRecordings?: number;
}

type DocumentInputPolicy = Awaited<ReturnType<typeof orpc.scribe.documentInputPolicy.call>>;

const fileToContextFile = async (uploaded: UploadedContextFile): Promise<RawContextDocument> => ({
	data: await blobToBase64(uploaded.file),
	mimeType: uploaded.file.type || "application/octet-stream",
	name: uploaded.file.name,
	size: uploaded.file.size,
});

const getAudioSubmissionPayloadBytes = (audioFile: InputContextAudioFile): number =>
	getBase64DecodedByteLength(audioFile.data) +
	getBase64DecodedByteLength(audioFile.wavFallback?.data);

export const useInputContextState = ({
	agent = false,
	maxRecordings = 3,
}: UseInputContextStateOptions = {}): InputContextController => {
	const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
	const [contextFiles, setContextFiles] = useState<UploadedContextFile[]>([]);
	const [ocrConfigured, setOcrConfigured] = useState(false);
	// Async OCR callbacks read and write the latest files without stale closures.
	const contextFilesRef = useRef(contextFiles);
	const ocrPromisesRef = useRef(new Map<string, Promise<void>>());
	// One policy request per session instead of one per file; submission refreshes it.
	const policyRef = useRef<Promise<DocumentInputPolicy> | null>(null);
	const loadPolicy = useCallback((refresh = false) => {
		if (refresh || !policyRef.current) {
			policyRef.current = (async () => {
				try {
					const policy = await orpc.scribe.documentInputPolicy.call();
					setOcrConfigured(policy.ocrConfigured);
					return policy;
				} catch (error: unknown) {
					policyRef.current = null;
					throw error;
				}
			})();
		}
		return policyRef.current;
	}, []);
	useEffect(() => {
		(async () => {
			try {
				await loadPolicy();
			} catch {
				toast.error("Dokumenten-Einstellungen konnten nicht geladen werden.");
			}
		})();
	}, [loadPolicy]);
	const commitContextFiles = useCallback((next: UploadedContextFile[]) => {
		contextFilesRef.current = next;
		setContextFiles(next);
	}, []);
	const updateContextFile = useCallback(
		(id: string, patch: Partial<UploadedContextFile>) =>
			commitContextFiles(
				contextFilesRef.current.map((file) => (file.id === id ? { ...file, ...patch } : file)),
			),
		[commitContextFiles],
	);
	const [textContext, setTextContextState] = useState<InputContextTextContext>({});
	const effectiveMaxRecordings = Math.min(maxRecordings, FILL_INPUT_PAYLOAD_LIMITS.maxAudioFiles);

	const textContextFieldCount = getTextContextFieldCount(textContext);
	const hasTextContext = textContextFieldCount > 0;
	const hasAudioRecordings = audioRecordings.length > 0;
	const hasContextFiles = contextFiles.length > 0;
	const hasAnyContext = hasAudioRecordings || hasTextContext || hasContextFiles;

	const addAudioFiles = useCallback(
		(files: File[]) => {
			const result = addAudioFilesToValue({
				currentRecordings: audioRecordings,
				files,
				maxRecordings: effectiveMaxRecordings,
			});
			if (!result.ok) {
				if (result.message) {
					toast.error(result.message);
				}
				return false;
			}

			setAudioRecordings(result.recordings);
			return true;
		},
		[audioRecordings, effectiveMaxRecordings],
	);

	const addContextFiles = useCallback(
		(files: File[]) => {
			const result = addContextFilesToValue({
				currentFiles: contextFilesRef.current,
				files,
			});
			if (!result.ok) {
				if (result.message) {
					toast.error(result.message);
				}
				return false;
			}

			commitContextFiles(result.files);
			return true;
		},
		[commitContextFiles],
	);

	const runOcr = useCallback(
		(uploaded: UploadedContextFile) => {
			if (ocrPromisesRef.current.has(uploaded.id)) {
				return;
			}
			const promise = (async () => {
				try {
					const policy = await loadPolicy();
					if (!policy.ocrConfigured) {
						updateContextFile(uploaded.id, { ocrStatus: "skipped" });
						return;
					}
					const file = await fileToContextFile(uploaded);
					const { result } = await orpc.scribe.extractContextFile.call({ file });
					updateContextFile(uploaded.id, {
						ocrError: undefined,
						ocrResult: result,
						ocrStatus: "complete",
					});
				} catch (error: unknown) {
					updateContextFile(uploaded.id, {
						ocrError: error instanceof Error ? error.message : "OCR ist fehlgeschlagen.",
						ocrStatus: "error",
					});
				} finally {
					ocrPromisesRef.current.delete(uploaded.id);
				}
			})();
			ocrPromisesRef.current.set(uploaded.id, promise);
		},
		[loadPolicy, updateContextFile],
	);

	useEffect(() => {
		for (const file of contextFiles) {
			if (file.ocrStatus === "pending") {
				runOcr(file);
			}
		}
	}, [contextFiles, runOcr]);

	const replaceContextFiles = useCallback(
		(files: UploadedContextFile[]) =>
			commitContextFiles(
				files.map((file) =>
					file.ocrStatus
						? file
						: { ...file, ocrStatus: createUploadedContextFile(file.file).ocrStatus },
				),
			),
		[commitContextFiles],
	);

	const retryContextFileOcr = useCallback(
		(id: string) => updateContextFile(id, { ocrError: undefined, ocrStatus: "pending" }),
		[updateContextFile],
	);

	const rotateContextFile = useCallback(
		async (id: string, turn: 0 | 90 | 180 | 270) => {
			const current = contextFilesRef.current.find((file) => file.id === id);
			if (!current) {
				return null;
			}
			try {
				// A new id keeps a still-running OCR request for the old orientation from
				// overwriting the rotated file's result.
				const rotated = {
					...createUploadedContextFile(await rotateImageFile(current.file, turn)),
					ocrStatus: "pending" as const,
				};
				commitContextFiles(
					contextFilesRef.current.map((file) => (file.id === id ? rotated : file)),
				);
				return rotated;
			} catch (error: unknown) {
				toast.error(
					error instanceof Error ? error.message : "Das Bild konnte nicht gedreht werden.",
				);
				return null;
			}
		},
		[commitContextFiles],
	);

	const setTextContext = useCallback((nextTextContext: InputContextTextContext) => {
		if (
			getTextContextCharacterCount(nextTextContext) >
			FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters
		) {
			toast.error(
				`Textkontext ist zu lang. Maximal ${FILL_INPUT_PAYLOAD_LIMITS.maxTextContextCharacters.toLocaleString("de-DE")} Zeichen möglich.`,
			);
			return;
		}

		setTextContextState(nextTextContext);
	}, []);

	const setContextFileOcrResults = useCallback(
		(results: OcrResult[]) =>
			commitContextFiles(
				contextFilesRef.current.map((contextFile, index) =>
					results[index]
						? { ...contextFile, ocrResult: results[index], ocrStatus: "complete" }
						: contextFile,
				),
			),
		[commitContextFiles],
	);

	const prepareSubmission = useCallback(async (): Promise<InputContextSubmission> => {
		let policy: DocumentInputPolicy | undefined;
		if (contextFilesRef.current.length > 0) {
			policy = await loadPolicy(true);
			if (policy.ocrConfigured) {
				if (contextFilesRef.current.some((file) => file.ocrStatus === "awaiting-alignment")) {
					throw new Error("Bitte Bilder in der Vorschau manuell ausrichten und die OCR starten.");
				}
				await Promise.all(ocrPromisesRef.current.values());
				// A submit can happen before the upload effect has started its requests.
				for (const file of contextFilesRef.current) {
					if (file.ocrStatus !== "error" && (file.ocrStatus !== "complete" || !file.ocrResult)) {
						updateContextFile(file.id, { ocrStatus: "pending" });
						runOcr(file);
					}
				}
				await Promise.all(ocrPromisesRef.current.values());
			} else if (!(agent ? policy.agentSupportsDocuments : policy.supportsDocuments)) {
				throw new Error(
					"Bitte ein Dokumenten-Modell oder ein Vision-fähiges Modell konfigurieren.",
				);
			}
		}
		const latestContextFiles = contextFilesRef.current;
		const audioFiles = await Promise.all(
			audioRecordings.map((recording) => createAudioSubmissionFile(recording.blob)),
		);
		let audioPayloadBytes = 0;
		for (const [index, audioFile] of audioFiles.entries()) {
			const recordingPayloadBytes = getAudioSubmissionPayloadBytes(audioFile);
			audioPayloadBytes += recordingPayloadBytes;
			if (recordingPayloadBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording) {
				throw new Error(
					`Aufnahme ${index + 1} ist zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesPerRecording)} pro Aufnahme.`,
				);
			}
		}
		if (audioPayloadBytes > FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal) {
			throw new Error(
				`Audioaufnahmen sind zusammen zu groß. Maximal ${formatPayloadBytes(FILL_INPUT_PAYLOAD_LIMITS.maxAudioPayloadBytesTotal)} möglich.`,
			);
		}

		const submittedContextFiles: InputContextFile[] = policy?.ocrConfigured
			? latestContextFiles.map((file) => {
					if (file.ocrStatus !== "complete" || !file.ocrResult) {
						throw new Error(
							`OCR für „${file.file.name}“ ist nicht abgeschlossen. Bitte erneut versuchen.`,
						);
					}
					return {
						kind: "ocr" as const,
						name: file.file.name,
						ocrResult: file.ocrResult,
					};
				})
			: await Promise.all(latestContextFiles.map(fileToContextFile));

		return {
			audioFiles,
			contextFiles: submittedContextFiles,
			textContext: toSubmittedTextContext(textContext),
		};
	}, [agent, audioRecordings, loadPolicy, runOcr, textContext, updateContextFile]);

	return {
		addAudioFiles,
		addContextFiles,
		audioRecordings,
		contextFiles,
		effectiveMaxRecordings,
		hasAnyContext,
		hasAudioRecordings,
		hasContextFiles,
		hasTextContext,
		ocrConfigured,
		prepareSubmission,
		retryContextFileOcr,
		rotateContextFile,
		setAudioRecordings,
		setContextFileOcrResults,
		setContextFiles: replaceContextFiles,
		setTextContext,
		textContext,
	};
};
