import { expect, spyOn, test } from "bun:test";

import { call } from "@orpc/server";
import { aiProvider, eq, usageEvent, userAiProvider } from "@repo/database";
import sharp from "sharp";

import { ocrMockState } from "@/__tests__/preload";
import {
	createTestAiDefaults,
	createTestDecisionModel,
	createTestContext,
	createTestSubscription,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { encrypt } from "@/lib/encryption";
import { resolveDocumentCitationsHandler } from "@/orpc/scribe/handlers/resolve-document-citation";

test("authenticated quote localization returns page-frame bounds, rejects changed numbers and keeps usage private", async () => {
	const server = await startTestServer("citation-location");
	const originalFetch = globalThis.fetch;
	let malformed = false;
	let decisionCalls = 0;
	const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(
			(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
				if (String(url) !== "https://openrouter.ai/api/alpha/decisions") {
					return originalFetch(url, init);
				}
				const request = JSON.parse(String(init?.body)) as {
					model: string;
					provider: unknown;
					questions: Record<string, { instructions: string }>;
				};
				decisionCalls += 1;
				expect(request.model).toBe("typesafe/jev-1.14-20261014");
				expect(request.provider).toEqual({ data_collection: "deny", zdr: true });
				// All quotes of a page are located in one request.
				const answers = Object.fromEntries(
					Object.entries(request.questions).map(([key, question]) => [
						key,
						key.startsWith("present")
							? { noul: question.instructions.includes('"PAWP 18"') ? 0.01 : 0.95 }
							: { box: { bottom: 0.5, left: malformed ? -0.1 : 0.2, right: 0.6, top: 0.3 } },
					]),
				);
				return Promise.resolve(
					Response.json({
						answers,
						model: "typesafe/jev-1.14-20261014",
						usage: { cost: 0.000123, input_tokens: 100, output_tokens: 0 },
					}),
				);
			},
			{ preconnect: originalFetch.preconnect },
		),
	);
	try {
		const { providerId } = await createTestAiDefaults(server.db);
		await server.db
			.update(aiProvider)
			.set({ apiKey: await encrypt("synthetic-key") })
			.where(eq(aiProvider.id, providerId));
		const { session, user } = await createTestUser(server.db);
		const context = createTestContext({ db: server.db, session });
		const image = await sharp({
			create: { background: "white", channels: 3, height: 900, width: 600 },
		})
			.png()
			.toBuffer();
		const file = {
			data: image.toString("base64"),
			mimeType: "image/png",
			name: "scan.png",
			size: image.length,
		};
		// Without a decision model the original page is shown without a highlight.
		expect(
			await call(resolveDocumentCitationsHandler, { file, quotes: ["PAWP 8"] }, { context }),
		).toEqual([null]);
		await createTestDecisionModel(server.db, providerId, "typesafe/jev-1.14-20261014");
		await createTestSubscription(server.db, user.id);
		const [result, changed] = await call(
			resolveDocumentCitationsHandler,
			{ file, quotes: ["PAWP 8", "PAWP 18"] },
			{ context },
		);
		expect(decisionCalls).toBe(1);
		// A changed number is not the cited entry.
		expect(changed).toBeNull();
		expect(result).toMatchObject({
			pageHeight: 900,
			pageNumber: 1,
			pageWidth: 600,
			quote: "PAWP 8",
		});
		expect(result?.bounds.x).toBeCloseTo(84);
		expect(result?.bounds.y).toBeCloseTo(261);
		expect(result?.bounds.width).toBeCloseTo(312);
		expect(result?.bounds.height).toBeCloseTo(198);
		malformed = true;
		await expect(
			call(resolveDocumentCitationsHandler, { file, quotes: ["PAWP 8"] }, { context }),
		).rejects.toThrow("Quellenmarkierung ist derzeit nicht verfügbar");
		await expect(
			call(
				resolveDocumentCitationsHandler,
				{ file: { ...file, mimeType: "text/plain" }, quotes: ["PAWP 8"] },
				{ context },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			call(
				resolveDocumentCitationsHandler,
				{ file, quotes: ["PAWP 8"] },
				{ context: createTestContext({ db: server.db }) },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		// Deferred accounting must record inference cost without image or quote content.
		let events: (typeof usageEvent.$inferSelect)[] = [];
		for (let i = 0; i < 20; i += 1) {
			events = await server.db.select().from(usageEvent).where(eq(usageEvent.userId, user.id));
			if (events.length >= 2) {
				break;
			}
			await Bun.sleep(10);
		}
		expect(events).toHaveLength(2);
		expect(JSON.stringify(events)).not.toContain("PAWP");
		expect(JSON.stringify(events)).not.toContain(file.data);
		expect(Number(events[0].cost)).toBeCloseTo(0.000123, 6);
	} finally {
		fetchSpy.mockRestore();
		delete ocrMockState.result;
		await server.close();
	}
});

test("fully BYOK users never send documents to an operator-paid decision model", async () => {
	const server = await startTestServer("citation-location-byok");
	let decisionCalls = 0;
	const originalFetch = globalThis.fetch;
	const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
		Object.assign(
			(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
				if (String(url) === "https://openrouter.ai/api/alpha/decisions") {
					decisionCalls += 1;
				}
				return originalFetch(url, init);
			},
			{ preconnect: originalFetch.preconnect },
		),
	);
	try {
		const { providerId } = await createTestAiDefaults(server.db);
		await server.db
			.update(aiProvider)
			.set({ byokEnabled: true })
			.where(eq(aiProvider.id, providerId));
		// The decision model runs on a separate provider with the operator's key.
		const operatorProviderId = crypto.randomUUID();
		await server.db.insert(aiProvider).values({
			apiKey: await encrypt("operator-key"),
			id: operatorProviderId,
			name: "Operator OpenRouter",
			protocol: "openrouter",
		});
		await createTestDecisionModel(server.db, operatorProviderId);
		const { session, user } = await createTestUser(server.db);
		await server.db.insert(userAiProvider).values({
			apiKey: await encrypt("user-key"),
			enabled: true,
			name: "Eigener Schlüssel",
			providerId,
			userId: user.id,
			validatedAt: new Date(),
		});
		const image = await sharp({
			create: { background: "white", channels: 3, height: 90, width: 60 },
		})
			.png()
			.toBuffer();
		const file = {
			data: image.toString("base64"),
			mimeType: "image/png",
			name: "scan.png",
			size: image.length,
		};
		expect(
			await call(
				resolveDocumentCitationsHandler,
				{ file, quotes: ["PAWP 8"] },
				{ context: createTestContext({ db: server.db, session }) },
			),
		).toEqual([null]);
		expect(decisionCalls).toBe(0);
	} finally {
		fetchSpy.mockRestore();
		await server.close();
	}
});
