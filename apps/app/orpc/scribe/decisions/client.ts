import { z } from "zod";

const responseSchema = z.object({
	answers: z.record(z.string(), z.unknown()),
	model: z.string(),
	usage: z.object({
		cost: z.number().nonnegative(),
		input_tokens: z.number().int().nonnegative(),
		output_tokens: z.number().int().nonnegative(),
	}),
});

export type DecisionResponse = z.infer<typeof responseSchema>;

export type DecisionQuestions = Record<
	string,
	{ type: "choice" | "box" | "noul"; instructions: string; criteria?: Record<string, string> }
>;

/**
 * OpenRouter Decisions API transport for the configured decision model.
 * Callers own evidence, acceptance thresholds and LLM fallback.
 */
export const requestDecision = async ({
	apiKey,
	model,
	questions,
	signal,
	state,
}: {
	apiKey: string;
	model: string;
	questions: DecisionQuestions;
	signal: AbortSignal;
	state: string | unknown[];
}): Promise<DecisionResponse> => {
	const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
		body: JSON.stringify({
			model,
			provider: { data_collection: "deny" },
			questions,
			state,
		}),
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			// TypeSafe's models only accept experimental image state with this opt-in.
			...(Array.isArray(state) && model.startsWith("typesafe/")
				? { "TypeSafe-Danger-Zone-Images": "true" }
				: {}),
		},
		method: "POST",
		signal,
	});
	// Neither provider errors nor validation errors may expose patient data or keys.
	if (!response.ok) {
		throw new Error("Die Entscheidung ist derzeit nicht verfügbar.");
	}
	const parsed = responseSchema.safeParse(await response.json());
	if (!parsed.success) {
		throw new Error("Die Entscheidung ist ungültig.");
	}
	return parsed.data;
};
