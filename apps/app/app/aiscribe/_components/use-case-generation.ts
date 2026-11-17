"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToUnproxiedDataStream } from "@orpc/client";
import { createMdscribeSource } from "markdoc-md/citations";
import type { CitationRequest } from "markdoc-md/citations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
	InputContextAudioFile,
	InputContextController,
	InputContextFile,
	InputContextSubmission,
	InputContextTextContext,
} from "@/app/_components/input-context/types";
import type { ScribeCitation, ScribeCitationSource } from "@/features/response-citations/markup";
import { splitSectionOutput } from "@/features/template-tags/sections";
import { getAiscribeErrorMessage } from "@/lib/aiscribe-errors";
import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";
import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

/** A generated statement of a section and the evidence supporting it. */
export interface SectionEvidence {
	citations: ScribeCitation["citations"];
	text: string;
}

export const getMessageText = (message?: OcrUIMessage) =>
	message?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("") ?? "";

/**
 * Section texts of an answer by id. An answer without section frames, as for a
 * template without sections or a single regenerated section, is `soleSectionId`'s text;
 * so are frames of other ids, as when a template's only section is plain text.
 */
export const getSectionTexts = (text: string, soleSectionId?: string): Record<string, string> => {
	const sections = splitSectionOutput(text);
	if (!soleSectionId || soleSectionId in sections) {
		return sections;
	}
	const framed = Object.values(sections);
	if (framed.length > 0) {
		return { [soleSectionId]: framed.join("\n\n") };
	}
	// A frame still streaming in has no text yet.
	return text.trimStart().startsWith("{%") ? {} : { [soleSectionId]: text.trim() };
};

/** The cited statements of an answer, by the section containing them. */
export const collectSectionEvidence = (message?: OcrUIMessage, soleSectionId?: string) => {
	const text = getMessageText(message);
	const ranges = Object.entries(getSectionTexts(text, soleSectionId)).map(([id, sectionText]) => {
		const start = text.indexOf(sectionText);
		return { end: start + sectionText.length, id, start };
	});
	const evidence: Record<string, SectionEvidence[]> = {};
	for (const part of message?.parts ?? []) {
		if (part.type !== "data-citation") {
			continue;
		}
		const { citations, end, start } = part.data;
		const range = ranges.find((item) => item.start >= 0 && item.start <= start && end <= item.end);
		if (range) {
			(evidence[range.id] ??= []).push({ citations, text: text.slice(start, end) });
		}
	}
	return evidence;
};

/** What the letter's citations open: submitted files, their OCR, and the cited text inputs. */
export interface CitationSources {
	files: ReadonlyMap<string, File>;
	ocrResults: ReadonlyMap<string, OcrResult>;
	texts: ReadonlyMap<string, ScribeCitationSource>;
}

interface CaseRequest {
	audioFiles: InputContextAudioFile[];
	audioTranscripts?: string[];
	contextFiles: InputContextFile[];
	recordingIds: string[];
	textContext: InputContextTextContext;
}

const merge = <K, V>(previous: ReadonlyMap<K, V>, next?: ReadonlyMap<K, V>) =>
	next?.size ? new Map([...previous, ...next]) : previous;

const toOcrSources = (contextFiles: InputContextFile[], results: (OcrResult | undefined)[]) =>
	new Map(
		contextFiles.flatMap((file, index) => {
			const result = results[index];
			return file.id && result ? [[createMdscribeSource("file", file.id), result] as const] : [];
		}),
	);

/**
 * The letter's case input as every generation sends it, whole letter or one section:
 * text, files with their OCR text, and audio, which goes as its transcript once a
 * generation has transcribed it. Collects the sources the citations open.
 */
export const useCaseInput = (controller: InputContextController) => {
	const controllerRef = useRef(controller);
	controllerRef.current = controller;
	const [sources, setSources] = useState<CitationSources>({
		files: new Map(),
		ocrResults: new Map(),
		texts: new Map(),
	});
	const addSources = useCallback((next: Partial<CitationSources>) => {
		setSources((previous) => ({
			files: merge(previous.files, next.files),
			ocrResults: merge(previous.ocrResults, next.ocrResults),
			texts: merge(previous.texts, next.texts),
		}));
	}, []);

	/** Reuses a submission the input controls already prepared, else prepares one. */
	const prepare = useCallback(
		async (prepared?: InputContextSubmission): Promise<CaseRequest> => {
			const { current } = controllerRef;
			const submission = prepared ?? (await current.prepareSubmission());
			const recordingIds = current.audioRecordings.map(({ id }) => id);
			const transcripts = current.audioRecordings.map(({ transcript }) => transcript ?? "");
			const reuseTranscripts = recordingIds.length > 0 && transcripts.every(Boolean);
			addSources({
				files: new Map(submission.preparedContextFiles.map(({ file, id }) => [id, file])),
				ocrResults: toOcrSources(
					submission.contextFiles,
					submission.contextFiles.map((file) => (file.kind === "ocr" ? file.ocrResult : undefined)),
				),
			});
			return {
				audioFiles: reuseTranscripts ? [] : submission.audioFiles,
				audioTranscripts: reuseTranscripts ? transcripts : undefined,
				contextFiles: submission.contextFiles,
				recordingIds,
				textContext: submission.textContext,
			};
		},
		[addSources],
	);

	const remember = useCallback(
		(request: CaseRequest, part: OcrUIMessage["parts"][number]) => {
			if (part.type === "data-ocr-results") {
				controllerRef.current.setContextFileOcrResults(
					part.data,
					request.contextFiles.map(({ id }) => id),
				);
				addSources({ ocrResults: toOcrSources(request.contextFiles, part.data) });
			} else if (
				part.type === "data-audio-transcripts" &&
				// Only one transcript per recording can be matched to its recording.
				part.data.length === request.recordingIds.length
			) {
				// Stored on the recording, so every template of the case reuses it.
				const { current } = controllerRef;
				current.setAudioRecordings(
					current.audioRecordings.map((recording) => {
						const transcript = part.data[request.recordingIds.indexOf(recording.id)];
						return transcript ? { ...recording, transcript } : recording;
					}),
				);
			} else if (part.type === "data-citation-sources") {
				addSources({ texts: new Map(part.data.map((source) => [source.source, source])) });
			}
		},
		[addSources],
	);

	return useMemo(() => ({ prepare, remember, sources }), [prepare, remember, sources]);
};

export type CaseInput = ReturnType<typeof useCaseInput>;

/** One generation from the letter's template; `generate` adds the payload, such as the target section. */
export const useCaseGeneration = ({
	caseInput,
	chatId,
	onError,
	prefetchCitations,
	templateId,
}: {
	caseInput: CaseInput;
	chatId: string;
	onError?: () => void;
	/** Gets every citation of a finished answer, so document quotes are located before a click. */
	prefetchCitations?: (citations: CitationRequest[]) => void;
	templateId: string;
}) => {
	const requestRef = useRef<CaseRequest | null>(null);
	// useChat keeps the callbacks of its first render; they read only refs and stable functions.
	const { messages, sendMessage, setMessages, status, stop } = useChat<OcrUIMessage>({
		id: chatId,
		onData: (part) => {
			if (requestRef.current) {
				caseInput.remember(requestRef.current, part);
			}
		},
		onError: (error) => {
			const message = getAiscribeErrorMessage(error);
			if (message) {
				toast.error(message);
			}
			onError?.();
		},
		transport: {
			reconnectToStream() {
				throw new Error("Unsupported");
			},
			async sendMessages(options) {
				const request = requestRef.current;
				return eventIteratorToUnproxiedDataStream(
					await orpc.scribeStream.call(
						{
							audioFiles: request?.audioFiles.length ? request.audioFiles : undefined,
							audioTranscripts: request?.audioTranscripts,
							contextFiles: request?.contextFiles.length ? request.contextFiles : undefined,
							messages: options.messages,
							templateId,
						},
						{ signal: options.abortSignal },
					),
				);
			},
		},
	});

	const generate = useCallback(
		async (payload: Record<string, unknown>, submission?: InputContextSubmission) => {
			try {
				requestRef.current = await caseInput.prepare(submission);
			} catch (error) {
				toast.error(
					error instanceof Error && error.message ? error.message : USER_MESSAGES.unknownError,
				);
				onError?.();
				return;
			}
			setMessages([]);
			await sendMessage({
				text: JSON.stringify({ ...requestRef.current.textContext, ...payload }),
			});
		},
		[caseInput, onError, sendMessage, setMessages],
	);

	const message = messages.findLast((item) => item.role === "assistant");
	const citationsComplete = message?.parts.some(
		(part) => part.type === "data-citation-status" && part.data === "complete",
	);
	useEffect(() => {
		if (citationsComplete && message) {
			prefetchCitations?.(
				message.parts.flatMap((part) => (part.type === "data-citation" ? part.data.citations : [])),
			);
		}
	}, [citationsComplete, message, prefetchCitations]);

	return {
		generate,
		isLoading: status === "streaming" || status === "submitted",
		message,
		stop,
	};
};
