import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";

import { aiMockState } from "@/__tests__/preload";
import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { scribeHandler } from "@/orpc/admin/scribe";
import { buildSelectedTemplateReference } from "@/orpc/scribe/context/template/compose";

describe("admin.scribe evaluation", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;

	beforeEach(async () => {
		server = await startTestServer("admin-scribe-evaluation");
		const { session } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: server.db, session });
		await createTestAiDefaults(server.db);
	});

	afterEach(async () => {
		await server?.close();
	});

	test("does not expose the retired numeric score evaluation endpoint", () => {
		expect(scribeHandler).not.toHaveProperty("evaluate");
	});

	test("evaluates a playground response with the current PDQI-9 prompt context", async () => {
		const evaluation = await call(
			scribeHandler.evaluateResponse,
			{
				documentType: "epikrise",
				inputs: {
					notes: "Der Verlauf war unkompliziert.",
					relevantTemplate: buildSelectedTemplateReference({
						content: "# Epikrise\n(( Nur den klinischen Verlauf ausgeben ))",
						examples: [],
						information: "Diagnosen werden in einem anderen Briefteil dokumentiert.",
						title: "Fokussierte Epikrise",
					}),
				},
				promptName: "epikrise",
				response: "Der stationäre Verlauf gestaltete sich unkompliziert.",
			},
			{ context },
		);
		const generationOptions = aiMockState.lastGenerateObjectOptions as { prompt: string };

		expect(generationOptions.prompt).toContain('"title": "Fokussierte Epikrise"');
		expect(generationOptions.prompt).toContain(
			"Diagnosen werden in einem anderen Briefteil dokumentiert.",
		);
		expect(generationOptions.prompt).toContain('"targetField": "epikrise"');
		expect(evaluation.instrument).toBe("PDQI-9");
		expect(evaluation.categories).toHaveLength(9);
		expect(evaluation.totalScore).toBe(36);
		expect(evaluation.maxScore).toBe(45);
	});

	test("returns only the preferred response for comparative evaluation", async () => {
		const result = await call(
			scribeHandler.evaluateComparison,
			{
				documentType: "anamnese",
				inputs: {
					promptName: "anamnese",
					variables: {
						notes: "Patient berichtet seit zwei Tagen ueber Husten.",
					},
				},
				responses: {
					a: "Anamnese: Seit zwei Tagen Husten.",
					b: "Anamnese: Keine Beschwerden.",
				},
			},
			{ context },
		);

		expect(result).toEqual({
			note: "Antwort A bleibt naeher an den Eingaben.",
			preferredResponse: "a",
		});
	});
});
