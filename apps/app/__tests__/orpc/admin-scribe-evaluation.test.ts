import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";

import type { TestServer } from "@/__tests__/setup";
import {
	ADMIN_EMAIL,
	createTestAiDefaults,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { scribeHandler } from "@/orpc/admin/scribe";

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
