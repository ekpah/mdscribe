import type { LanguageModel, streamText, UIMessageStreamWriter } from "ai";
import { createMdscribeSource } from "markdoc-md/citations";
import { validateMarkdocTemplate } from "markdoc-md/parse";

import type { Citation, CitationSource } from "@/features/citation-engine";
import { appMarkdocConfig } from "@/features/template-tags/config";
import type { OcrResult, OcrUIMessage } from "@/lib/ocr-types";
import { citeWithDecisionModel } from "@/orpc/scribe/decisions/cite";
import type { DecisionResponse, DecisionTarget } from "@/orpc/scribe/decisions/client";
import type { NamedInput } from "@/orpc/scribe/prompts/template";
import type { FillInputsContextFile } from "@/orpc/scribe/types";

import { addScribeCitations } from "../markup";
import type { ScribeCitation } from "../markup";
import { streamResponseCitations } from "./annotate";

type LlmFinish = NonNullable<Parameters<typeof streamText>[0]["onFinish"]>;

/**
 * The evidence of one generation: its background inputs, as in the prompt, and the
 * OCR text of its files with page geometry. Notes and audio transcripts are not cited.
 */
export const createResponseCitationSources = ({
	contextFiles,
	inputs,
	ocrResults,
}: {
	contextFiles: FillInputsContextFile[];
	inputs: readonly NamedInput[];
	ocrResults: OcrResult[];
}): CitationSource[] => [
	...inputs.map(({ id, name, text }) => ({
		label: name,
		source: createMdscribeSource("input", id),
		text,
	})),
	...contextFiles.flatMap((file, index) => {
		const ocr = ocrResults[index];
		return file.id && ocr?.text.trim()
			? [
					{
						label: file.name,
						pages: ocr.pages,
						source: createMdscribeSource("file", file.id),
						text: ocr.text,
					},
				]
			: [];
	}),
];

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
		reasoning?: Parameters<typeof streamText>[0]["reasoning"];
	};
	signal?: AbortSignal;
	sources: readonly CitationSource[];
}

/** Engine citations as answer marks, skipping any whose markup would break the answer. */
const toScribeCitations = (draft: string, citations: Citation[]): ScribeCitation[] => {
	const accepted: ScribeCitation[] = [];
	for (const { evidence, target } of citations) {
		if (target.kind !== "span") {
			continue;
		}
		const citation: ScribeCitation = {
			citations: evidence.map(({ quote, source }) => ({ quote, source })),
			end: target.end,
			start: target.start,
		};
		if (
			!validateMarkdocTemplate(
				addScribeCitations(draft, [...accepted, citation]),
				appMarkdocConfig,
			).some((diagnostic) => diagnostic.severity === "error")
		) {
			accepted.push(citation);
		}
	}
	return accepted;
};

const citeResponse = async function* citeResponse({
	decision,
	draft,
	llm,
	signal,
	sources,
}: CiteOptions) {
	if (decision) {
		try {
			const citations = await citeWithDecisionModel({
				markdown: draft,
				onUsage: decision.onUsage,
				signal,
				sources,
				target: decision.target,
			});
			yield* toScribeCitations(draft, citations);
			return;
		} catch {
			// Fall back to the LLM pass; provider errors may contain patient data.
			signal?.throwIfAborted();
		}
	}
	const startedAt = Date.now();
	yield* streamResponseCitations({
		draft,
		model: llm.model,
		onFinish: (event) => llm.onFinish(event, Date.now() - startedAt),
		providerOptions: llm.providerOptions,
		reasoning: llm.reasoning,
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
	// Page geometry stays on the server; the client resolves quotes against the text.
	writer.write({
		data: options.sources.map(({ label, source, text }) => ({ label, source, text })),
		type: "data-citation-sources",
	});
	writer.write({ data: "adding", id: "citations", type: "data-citation-status" });
	try {
		for await (const citation of citeResponse(options)) {
			// One part per span: a span re-emitted with another source replaces its part.
			writer.write({
				data: citation,
				id: `${citation.start}:${citation.end}`,
				type: "data-citation",
			});
		}
		writer.write({ data: "complete", id: "citations", type: "data-citation-status" });
	} catch {
		writer.write({ data: "failed", id: "citations", type: "data-citation-status" });
	}
};
