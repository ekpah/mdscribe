import type { Database } from "@repo/database";

import { citeMarkdown } from "@/features/citation-engine";
import type { DecisionQuestions, VerifyThresholds } from "@/features/citation-engine";
import { requestDecision } from "@/orpc/scribe/decisions/client";
import type { DecisionResponse, DecisionTarget } from "@/orpc/scribe/decisions/client";
import { resolveDecisionModel } from "@/orpc/scribe/providers";

/** The decision model for citations; fully BYOK requests never send data to an operator-paid model. */
export const resolveCitationDecisionModel = async (
	db: Database,
	userId: string,
	fullyByok: boolean,
) => {
	const model = await resolveDecisionModel(db, userId).catch(() => null);
	return model && (model.credentialSource === "user_byok" || !fullyByok) ? model : null;
};

// Only facts the sources write are cited. Benchmark (12 AI-Scribe answers × 2 runs,
// 28 hand-labelled interpretations, 50 planted errors): Decider at stated ≥ 0.5 cited
// 218/250 facts and no interpretation. Jev and Mammoth score the question less
// sharply (Jev at 0.7 still cited 2, Mammoth at 0.5 cited 4), so a fact also needs
// part of its words in the quote: Jev 211/250 facts, Mammoth 212/250, neither an
// interpretation. No model cited a planted error.
const thresholdsFor = ({ modelId }: DecisionTarget): VerifyThresholds => {
	if (modelId.startsWith("typesafe/")) {
		return { passage: 0.6, stated: 0.6, wording: 0.3 };
	}
	if (modelId.startsWith("baseten/")) {
		return { passage: 0.6, stated: 0.5, wording: 0.4 };
	}
	return { passage: 0.6, stated: 0.5, wording: null };
};
// Jev answers one request; Clef takes 64 questions per request and Decider 128.
const batchSizeFor = (target: DecisionTarget) =>
	target.modelId.startsWith("typesafe/") ? 2000 : 64;

/** All questions in parallel batches within one 20 s budget, reported as one response. */
const decideWith = async (
	target: DecisionTarget,
	questions: DecisionQuestions,
	state: string,
	signal: AbortSignal | undefined,
): Promise<DecisionResponse> => {
	const budget = AbortSignal.timeout(20_000);
	const entries = Object.entries(questions);
	const size = batchSizeFor(target);
	const responses = await Promise.all(
		Array.from({ length: Math.ceil(entries.length / size) }, (_, index) =>
			requestDecision(target, {
				questions: Object.fromEntries(entries.slice(index * size, (index + 1) * size)),
				signal: signal ? AbortSignal.any([signal, budget]) : budget,
				state,
			}),
		),
	);
	return {
		answers: Object.assign({}, ...responses.map(({ answers }) => answers)),
		model: responses[0]?.model ?? target.modelId,
		usage: {
			cost: responses.reduce((sum, { usage }) => sum + usage.cost, 0),
			input_tokens: responses.reduce((sum, { usage }) => sum + usage.input_tokens, 0),
			output_tokens: responses.reduce((sum, { usage }) => sum + usage.output_tokens, 0),
		},
	};
};

/**
 * The citation engine on a decision model, shared by AI-Scribe answers,
 * Brief-Baukasten sections and autofill. Throws when the model fails, so
 * callers can fall back to their LLM pass.
 */
export const citeWithDecisionModel = ({
	onUsage,
	signal,
	target,
	...options
}: Omit<Parameters<typeof citeMarkdown>[0], "decide" | "thresholds"> & {
	onUsage: (response: DecisionResponse, durationMs: number) => void;
	signal?: AbortSignal;
	target: DecisionTarget;
}) => {
	const startedAt = Date.now();
	return citeMarkdown({
		...options,
		decide: async (questions, state) => {
			const response = await decideWith(target, questions, state, signal);
			onUsage(response, Date.now() - startedAt);
			return response;
		},
		thresholds: thresholdsFor(target),
	});
};
