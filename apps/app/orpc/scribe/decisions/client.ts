import type { ModelCost } from "@repo/database";
import { z } from "zod";

/** Answers keyed by question id, in the OpenRouter/Clef shape callers parse. */
export interface DecisionResponse {
	answers: Record<string, unknown>;
	model: string;
	usage: { cost: number; input_tokens: number; output_tokens: number };
}

export type DecisionQuestions = Record<
	string,
	{ type: "choice" | "box" | "noul"; instructions: string; criteria?: Record<string, string> }
>;

export const DECISION_PROTOCOLS = ["openrouter", "workers-ai", "openai"] as const;
export type DecisionProtocol = (typeof DECISION_PROTOCOLS)[number];

export const isDecisionProtocol = (protocol: string): protocol is DecisionProtocol =>
	(DECISION_PROTOCOLS as readonly string[]).includes(protocol);

/** Where and how to send decision questions; `baseUrl` is already expanded. */
export interface DecisionTarget {
	apiKey: string;
	baseUrl: string | null;
	cost: ModelCost | null;
	modelId: string;
	protocol: DecisionProtocol;
}

interface DecisionRequest {
	questions: DecisionQuestions;
	signal: AbortSignal;
	/** Text, or OpenRouter content parts with images (OpenRouter only). */
	state: string | unknown[];
}

const probability = z.number().min(0).max(1);
const tokens = z.number().int().nonnegative();
const openRouterSchema = z.object({
	answers: z.record(z.string(), z.unknown()),
	model: z.string(),
	usage: z.object({ cost: z.number().nonnegative(), input_tokens: tokens, output_tokens: tokens }),
});
// Clef answers already use the OpenRouter shape; the REST API may wrap them in `result`.
const clefSchema = z.object({
	answers: z.record(z.string(), z.unknown()),
	model: z.string(),
	usage: z.object({ input_tokens: tokens, output_tokens: tokens }),
});
const openAiSchema = z.object({
	answers: z.array(
		z.union([
			z.object({ name: z.string(), probability, type: z.literal("predicate") }),
			z.object({
				choice: z.union([z.string(), z.boolean()]),
				confidence: probability,
				name: z.string(),
				probabilities: z.array(
					z.object({ probability, value: z.union([z.string(), z.boolean()]) }),
				),
				type: z.literal("choice"),
			}),
			// Refusals and scores are left unanswered; callers fall back to the LLM.
			z.object({ name: z.string().nullable(), type: z.string() }),
		]),
	),
	model: z.string(),
	usage: z.object({ input_tokens: tokens, output_tokens: tokens }),
});

/** Clef accepts at most 64 questions per request. */
const CLEF_MAX_QUESTIONS = 64;

// Neither provider errors nor validation errors may expose patient data or keys.
const post = async (
	url: string,
	apiKey: string,
	body: unknown,
	signal: AbortSignal,
	headers: Record<string, string> = {},
) => {
	const response = await fetch(url, {
		body: JSON.stringify(body),
		headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...headers },
		method: "POST",
		signal,
	});
	if (!response.ok) {
		throw new Error("Die Entscheidung ist derzeit nicht verfügbar.");
	}
	return (await response.json()) as unknown;
};

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		throw new Error("Die Entscheidung ist ungültig.");
	}
	return parsed.data;
};

/** Providers without a reported cost are priced from the model's input rate. */
const priceInput = (target: DecisionTarget, inputTokens: number) =>
	(inputTokens * (target.cost?.input ?? 0)) / 1_000_000;

const requireTextState = (state: string | unknown[]): string => {
	if (typeof state !== "string") {
		throw new TypeError("Dieses Entscheidungsmodell unterstützt keine Bilder.");
	}
	return state;
};

const requestOpenRouter = async (
	target: DecisionTarget,
	{ questions, signal, state }: DecisionRequest,
): Promise<DecisionResponse> => {
	const body = await post(
		"https://openrouter.ai/api/alpha/decisions",
		target.apiKey,
		{ model: target.modelId, provider: { data_collection: "deny" }, questions, state },
		signal,
		// TypeSafe's models only accept experimental image state with this opt-in.
		Array.isArray(state) && target.modelId.startsWith("typesafe/")
			? { "TypeSafe-Danger-Zone-Images": "true" }
			: {},
	);
	return parse(openRouterSchema, body);
};

const requestWorkersAi = async (
	target: DecisionTarget,
	{ questions, signal, state }: DecisionRequest,
): Promise<DecisionResponse> => {
	if (!target.baseUrl) {
		throw new Error("Workers AI provider is missing its account base URL");
	}
	const text = requireTextState(state);
	// `…/accounts/{id}/ai/v1` serves chat; System One models run at `…/ai/run/<model>`.
	const url = `${target.baseUrl.replace(/\/v1$/, "")}/run/${target.modelId}`;
	const entries = Object.entries(questions);
	if (entries.some(([, question]) => question.type === "box")) {
		throw new Error("Clef unterstützt keine Box-Fragen.");
	}
	const batches = Array.from({ length: Math.ceil(entries.length / CLEF_MAX_QUESTIONS) }, (_, i) =>
		Object.fromEntries(entries.slice(i * CLEF_MAX_QUESTIONS, (i + 1) * CLEF_MAX_QUESTIONS)),
	);
	const responses = await Promise.all(
		batches.map(async (batch) => {
			const body = (await post(
				url,
				target.apiKey,
				{ model: target.modelId.split("/").at(-1), questions: batch, state: text },
				signal,
			)) as { result?: unknown };
			return parse(clefSchema, body.result ?? body);
		}),
	);
	const inputTokens = responses.reduce((sum, { usage }) => sum + usage.input_tokens, 0);
	return {
		answers: Object.assign({}, ...responses.map(({ answers }) => answers)),
		model: target.modelId,
		usage: {
			cost: priceInput(target, inputTokens),
			input_tokens: inputTokens,
			output_tokens: responses.reduce((sum, { usage }) => sum + usage.output_tokens, 0),
		},
	};
};

/** OpenAI takes ordered, named questions and returns ordered answers with typed values. */
const requestOpenAi = async (
	target: DecisionTarget,
	{ questions, signal, state }: DecisionRequest,
): Promise<DecisionResponse> => {
	const body = await post(
		`${target.baseUrl ?? "https://api.openai.com/v1"}/decisions`,
		target.apiKey,
		{
			input: requireTextState(state),
			model: target.modelId,
			questions: Object.entries(questions).map(([name, question]) => {
				if (question.type === "box") {
					throw new Error("OpenAI Decisions unterstützt keine Box-Fragen.");
				}
				return question.type === "noul"
					? { instructions: question.instructions, name, type: "predicate" }
					: {
							choices: Object.entries(question.criteria ?? {}).map(([value, description]) => ({
								description,
								value,
							})),
							instructions: question.instructions,
							name,
							type: "choice",
						};
			}),
		},
		signal,
	);
	const response = parse(openAiSchema, body);
	const answers: Record<string, unknown> = {};
	for (const answer of response.answers) {
		if (answer.type === "predicate" && "probability" in answer) {
			answers[answer.name] = { noul: answer.probability, type: "noul" };
		} else if (answer.type === "choice" && "choice" in answer) {
			answers[answer.name] = {
				choice: String(answer.choice),
				confidence: answer.confidence,
				probabilities: Object.fromEntries(
					answer.probabilities.map(({ probability: p, value }) => [String(value), p]),
				),
				type: "choice",
			};
		}
	}
	return {
		answers,
		model: response.model,
		usage: {
			cost: priceInput(target, response.usage.input_tokens),
			input_tokens: response.usage.input_tokens,
			output_tokens: response.usage.output_tokens,
		},
	};
};

/**
 * Decision-model transport for OpenRouter's Decisions API, Workers AI (Clef)
 * and OpenAI's Decisions API. Callers own evidence, acceptance thresholds and
 * LLM fallback. Box questions (image locations) only exist on OpenRouter.
 */
export const requestDecision = (
	target: DecisionTarget,
	request: DecisionRequest,
): Promise<DecisionResponse> =>
	({ openai: requestOpenAi, openrouter: requestOpenRouter, "workers-ai": requestWorkersAi })[
		target.protocol
	](target, request);
