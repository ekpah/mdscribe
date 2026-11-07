import type { LanguageModel, streamText, UIMessageStreamWriter } from "ai";
import { createMdscribeSource } from "markdoc-md/citations";

import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";
import type { DecisionResponse, DecisionTarget } from "@/orpc/scribe/decisions/client";
import type { FillInputsContextFile } from "@/orpc/scribe/types";

import type { ScribeCitationSource } from "../markup";
import { streamResponseCitations } from "./annotate";
import { matchResponseCitations } from "./match";

type LlmFinish = NonNullable<Parameters<typeof streamText>[0]["onFinish"]>;

/** Typed form inputs, audio transcripts and OCR text of one generation. */
export const createResponseCitationSources = ({
	audioTranscripts,
	contextFiles,
	formData,
	ocrResults,
}: {
	audioTranscripts: string[];
	contextFiles: FillInputsContextFile[];
	formData: Record<string, unknown>;
	ocrResults: OcrResult[];
}): ScribeCitationSource[] => {
	const labels: Record<string, string> = {
		anamnese: "Anamnese",
		befunde: "Befunde",
		diagnoseblock: "Diagnosen",
		epikrise: "Epikrise",
		notes: "Notizen",
	};
	const sources: ScribeCitationSource[] = Object.entries(labels).flatMap(([id, label]) => {
		const text = formData[id];
		return typeof text === "string" && text.trim()
			? [{ label, source: createMdscribeSource("input", id), text }]
			: [];
	});
	for (const [index, transcript] of audioTranscripts.entries()) {
		sources.push({
			label: `Transkript ${index + 1}`,
			source: createMdscribeSource("input", `transcript-${index + 1}`),
			text: transcript,
		});
	}
	for (const [index, file] of contextFiles.entries()) {
		const ocr = ocrResults[index];
		if (file.id && ocr?.text.trim()) {
			sources.push({
				label: file.name,
				source: createMdscribeSource("file", file.id),
				text: ocr.text,
			});
		}
	}
	return sources;
};

interface CiteOptions {
	/** Preferred: one decision-model request. Usage is reported with its duration. */
	decision: {
		onUsage: (response: DecisionResponse, durationMs: number) => void;
		target: DecisionTarget;
	} | null;
	draft: string;
	/** Used without a decision model, or when its request fails. */
	llm: {
		model: LanguageModel;
		onFinish: (event: Parameters<LlmFinish>[0], durationMs: number) => void;
		providerOptions?: Parameters<typeof streamText>[0]["providerOptions"];
	};
	signal?: AbortSignal;
	sources: readonly ScribeCitationSource[];
}

const citeResponse = async function* citeResponse({
	decision,
	draft,
	llm,
	signal,
	sources,
}: CiteOptions) {
	let startedAt = Date.now();
	if (decision) {
		try {
			yield* await matchResponseCitations({
				draft,
				onUsage: (response) => decision.onUsage(response, Date.now() - startedAt),
				signal,
				sources,
				target: decision.target,
			});
			return;
		} catch {
			// Fall back to the LLM pass; provider errors may contain patient data.
			signal?.throwIfAborted();
		}
		startedAt = Date.now();
	}
	yield* streamResponseCitations({
		draft,
		model: llm.model,
		onFinish: (event) => llm.onFinish(event, Date.now() - startedAt),
		providerOptions: llm.providerOptions,
		signal,
		sources,
	});
};

/**
 * Appends citations for a finished answer as `data-citation*` message parts.
 * Failures only mark the citations as failed and never expose provider errors.
 */
export const writeResponseCitations = async ({
	writer,
	...options
}: CiteOptions & {
	writer: Pick<UIMessageStreamWriter<OcrUIMessage>, "write">;
}) => {
	writer.write({ data: [...options.sources], type: "data-citation-sources" });
	writer.write({ data: "adding", id: "citations", type: "data-citation-status" });
	try {
		for await (const citation of citeResponse(options)) {
			writer.write({ data: citation, type: "data-citation" });
		}
		writer.write({ data: "complete", id: "citations", type: "data-citation-status" });
	} catch {
		writer.write({ data: "failed", id: "citations", type: "data-citation-status" });
	}
};
