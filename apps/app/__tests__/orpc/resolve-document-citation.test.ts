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
	let providerStatus = 200;
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
				if (providerStatus !== 200) {
					return Promise.resolve(
						Response.json(
							{ error: { message: "BaseTen does not accept box questions" } },
							{ status: providerStatus },
						),
					);
				}
				expect(request.model).toBe("typesafe/jev-1.14-20261014");
				expect(request.provider).toEqual({ data_collection: "deny" });
				// All quotes of a page are located in one request.
				const answers = Object.fromEntries(
					Object.entries(request.questions).map(([key, question]) => {
						if (key.startsWith("present")) {
							return [key, { noul: question.instructions.includes('"PAWP 18"') ? 0.01 : 0.95 }];
						}
						if (question.instructions.includes('"CRP 112 24"')) {
							return [key, { box: { bottom: 0.7, left: 0.6, right: 0.7, top: 0.1 } }];
						}
						if (question.instructions.includes('"Fieber seit gestern"')) {
							return [key, { box: { bottom: 0.75, left: 0.1, right: 0.8, top: 0.7 } }];
						}
						return [
							key,
							{ box: { bottom: 0.5, left: malformed ? -0.1 : 0.2, right: 0.6, top: 0.3 } },
						];
					}),
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
		const tableQuote = '<tr><td>**PAWP**</td><td colspan="2">8</td></tr>';
		const [result, changed] = await call(
			resolveDocumentCitationsHandler,
			{ file, quotes: [tableQuote, "PAWP 18"] },
			{ context },
		);
		expect(decisionCalls).toBe(1);
		// A changed number is not the cited entry.
		expect(changed).toBeNull();
		expect(result).toMatchObject({
			pageHeight: 900,
			pageNumber: 1,
			pageWidth: 600,
			quote: tableQuote,
		});
		expect(result?.bounds.x).toBeCloseTo(120);
		expect(result?.bounds.y).toBeCloseTo(270);
		expect(result?.bounds.width).toBeCloseTo(240);
		expect(result?.bounds.height).toBeCloseTo(180);
		// Nearby rules must not override the model's evidence-driven bounds.
		const ruledImage = await sharp(image)
			.composite([
				{
					input: Buffer.from(
						'<svg width="600" height="900"><path d="M70 220H520 M70 300H520 M70 410H520 M70 520H520" stroke="black" stroke-width="2"/></svg>',
					),
				},
			])
			.png()
			.toBuffer();
		const spanningQuote = tableQuote.replace("<td>", '<td rowspan="2">');
		const [row, spanning, column, prose] = await call(
			resolveDocumentCitationsHandler,
			{
				file: { ...file, data: ruledImage.toString("base64"), size: ruledImage.length },
				quotes: [tableQuote, spanningQuote, "CRP 112 24", "Fieber seit gestern"],
			},
			{ context },
		);
		if (!row) {
			throw new Error("Expected a highlighted table row");
		}
		expect(row.bounds.x).toBeCloseTo(120);
		expect(row.bounds.y).toBeCloseTo(270);
		expect(row.bounds.width).toBeCloseTo(240);
		expect(row.bounds.height).toBeCloseTo(180);
		expect(spanning?.bounds.y).toBeCloseTo(270);
		expect(spanning?.bounds.height).toBeCloseTo(180);
		expect(column?.bounds.x).toBeCloseTo(360);
		expect(column?.bounds.y).toBeCloseTo(90);
		expect(column?.bounds.width).toBeCloseTo(60);
		expect(column?.bounds.height).toBeCloseTo(540);
		expect(prose?.bounds.x).toBeCloseTo(60);
		expect(prose?.bounds.y).toBeCloseTo(630);
		expect(prose?.bounds.width).toBeCloseTo(420);
		expect(prose?.bounds.height).toBeCloseTo(45);
		malformed = true;
		await expect(
			call(resolveDocumentCitationsHandler, { file, quotes: ["PAWP 8"] }, { context }),
		).rejects.toThrow("Quellenmarkierung ist derzeit nicht verfügbar");
		malformed = false;
		// A model that rejects box questions shows the page without a highlight, instead of failing every retry.
		providerStatus = 400;
		expect(
			await call(resolveDocumentCitationsHandler, { file, quotes: ["PAWP 8"] }, { context }),
		).toEqual([null]);
		// Outages stay errors, so the client retries when the citation is opened.
		providerStatus = 503;
		await expect(
			call(resolveDocumentCitationsHandler, { file, quotes: ["PAWP 8"] }, { context }),
		).rejects.toThrow("Quellenmarkierung ist derzeit nicht verfügbar");
		providerStatus = 200;
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
			if (events.length >= 3) {
				break;
			}
			await Bun.sleep(10);
		}
		expect(events).toHaveLength(3);
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
