import { afterEach, describe, expect, test } from "bun:test";

import { requestDecision } from "@/orpc/scribe/decisions/client";

const { signal } = new AbortController();
const originalFetch = globalThis.fetch;

describe("decision transports", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("OpenAI receives ordered named questions and answers come back keyed by id", async () => {
		globalThis.fetch = ((url: string, init?: RequestInit) => {
			expect(url).toBe("https://api.openai.com/v1/decisions");
			const body = JSON.parse(String(init?.body));
			expect(body).toEqual({
				input: "state",
				model: "gpt-6-luna",
				questions: [
					{
						choices: [
							{ description: "Links", value: "o0" },
							{ description: "Nicht berichtet", value: "other" },
						],
						instructions: "Seite?",
						name: "f1_value",
						type: "choice",
					},
					{ instructions: "Vorhanden?", name: "present", type: "predicate" },
				],
			});
			// Answers arrive in question order, with array probabilities and a refusal.
			return Response.json({
				answers: [
					{
						choice: "o0",
						confidence: 0.9,
						name: "f1_value",
						probabilities: [
							{ probability: 0.97, value: "o0" },
							{ probability: 0.03, value: "other" },
						],
						type: "choice",
					},
					{ name: "present", type: "refusal" },
				],
				model: "gpt-6-luna",
				usage: { input_tokens: 2_000_000, output_tokens: 0 },
			});
		}) as unknown as typeof fetch;

		const response = await requestDecision(
			{
				apiKey: "key",
				baseUrl: null,
				cost: { input: 0.1 },
				modelId: "gpt-6-luna",
				protocol: "openai",
			},
			{
				questions: {
					f1_value: {
						criteria: { o0: "Links", other: "Nicht berichtet" },
						instructions: "Seite?",
						type: "choice",
					},
					present: { instructions: "Vorhanden?", type: "noul" },
				},
				signal,
				state: "state",
			},
		);
		expect(response.answers).toEqual({
			f1_value: {
				choice: "o0",
				confidence: 0.9,
				probabilities: { o0: 0.97, other: 0.03 },
				type: "choice",
			},
		});
		expect(response.usage.cost).toBeCloseTo(0.2);
	});

	test("Clef runs at the account's run URL in batches of 64 questions", async () => {
		const batchSizes: number[] = [];
		globalThis.fetch = ((url: string, init?: RequestInit) => {
			expect(url).toBe(
				"https://api.cloudflare.com/client/v4/accounts/abc/ai/run/@cf/cloudflare/clef",
			);
			const body = JSON.parse(String(init?.body));
			expect(body.model).toBe("clef");
			const ids = Object.keys(body.questions);
			batchSizes.push(ids.length);
			return Response.json({
				result: {
					answers: Object.fromEntries(ids.map((id) => [id, { noul: 1, type: "noul" }])),
					model: "clef",
					usage: { input_tokens: 1000, output_tokens: 0 },
				},
				success: true,
			});
		}) as unknown as typeof fetch;

		const response = await requestDecision(
			{
				apiKey: "key",
				baseUrl: "https://api.cloudflare.com/client/v4/accounts/abc/ai/v1",
				cost: { input: 0.24 },
				modelId: "@cf/cloudflare/clef",
				protocol: "workers-ai",
			},
			{
				questions: Object.fromEntries(
					Array.from({ length: 65 }, (_, index) => [
						`q${index}`,
						{ instructions: "?", type: "noul" as const },
					]),
				),
				signal,
				state: "state",
			},
		);
		expect(batchSizes.toSorted()).toEqual([1, 64]);
		expect(Object.keys(response.answers)).toHaveLength(65);
		expect(response.usage.input_tokens).toBe(2000);
		expect(response.usage.cost).toBeCloseTo(0.00048);
	});
});
