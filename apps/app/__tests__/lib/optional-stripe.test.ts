import { describe, expect, test } from "bun:test";

// Configuration is resolved at import time. Separate processes exercise the real
// modules in each mode without leaking mocks into the configured-Stripe suite.
const runScenario = async (configuration: Record<string, string | null>, source: string) => {
	const child = Bun.spawn(
		[
			process.execPath,
			"--preload",
			"./__tests__/preload.ts",
			"-e",
			`
				import { expect } from "bun:test";
				import { env } from "@/env";
				Object.assign(env, ${JSON.stringify(configuration)});
				${source}
				// The test setup intentionally retains its shared database connection.
				process.exit(0);
			`,
		],
		{ cwd: new URL("../../", import.meta.url).pathname, stderr: "pipe", stdout: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
};

describe("Optional Stripe", () => {
	test.each([null, ""])("disables integrations without a secret key (%s)", async (secretKey) => {
		await runScenario(
			{ STRIPE_SECRET_KEY: secretKey },
			`
			const { stripeConfig, subscriptionsEnabled } = await import("@/lib/stripe-config");
			expect(stripeConfig).toBeNull();
			expect(subscriptionsEnabled).toBe(false);
			const { auth } = await import("@/auth");
			expect(auth.options.plugins.some(plugin => plugin.id === "stripe")).toBe(false);
			for (const [path, method] of [["subscription/list", "GET"], ["subscription/upgrade", "POST"], ["subscription/cancel", "POST"], ["subscription/billing-portal", "POST"], ["stripe/webhook", "POST"]]) {
				const response = await auth.handler(new Request("http://localhost:3000/api/auth/" + path, { method }));
				expect(response.status).toBe(404);
			}
		`,
		);
	});

	test("retains the configured integration and rejects partial configuration", async () => {
		await runScenario(
			{},
			`
			const { stripeConfig, subscriptionsEnabled } = await import("@/lib/stripe-config");
			expect(subscriptionsEnabled).toBe(true);
			expect(stripeConfig.priceId).toBe("price_test_plus");
			expect(stripeConfig.annualPriceId).toBe("price_test_plus_annual");
			const { auth } = await import("@/auth");
			expect(auth.options.plugins.some(plugin => plugin.id === "stripe")).toBe(true);
		`,
		);
		for (const field of [
			"STRIPE_WEBHOOK_SECRET",
			"STRIPE_PLUS_PRICE_ID",
			"STRIPE_PLUS_PRICE_ID_ANNUAL",
		]) {
			await runScenario(
				{ [field]: null },
				`
				await expect(import("@/lib/stripe-config")).rejects.toThrow("required when STRIPE_SECRET_KEY is set");
			`,
			);
		}
	});

	test("sign-up works without creating a Stripe customer", async () => {
		await runScenario(
			{ STRIPE_SECRET_KEY: null },
			`
			const { mock } = await import("bun:test");
			const { startTestServer } = await import("@/__tests__/setup");
			const server = await startTestServer("optional-stripe-auth");
			try {
				mock.module("@repo/database/client", () => ({ database: server.db }));
				const { auth } = await import("@/auth");
				const response = await auth.handler(new Request("http://localhost:3000/api/auth/sign-up/email", {
					method: "POST", headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email: "signup@example.com", name: "New Free User", username: "new_free_user", password: "password123" }),
				}));
				expect(response.status).toBe(200);
				const { user } = await response.json();
				expect(user.email).toBe("signup@example.com");
				expect(user.stripeCustomerId ?? null).toBeNull();
				const storedUser = await server.db.query.user.findFirst();
				expect(storedUser.email).toBe("signup@example.com");
				expect(storedUser.stripeCustomerId).toBeNull();
			} finally {
				await server.close();
			}
		`,
		);
	});

	test("ignores stored Plus subscriptions in entitlements, quotas and admin reporting", async () => {
		await runScenario(
			{ STRIPE_SECRET_KEY: null },
			`
			const { call } = await import("@orpc/server");
			const { ADMIN_EMAIL, startTestServer, createTestUser, createTestSubscription, createTestUsageEvent, createTestContext } = await import("@/__tests__/setup");
			const { resolveProductEntitlements } = await import("@/lib/product-entitlements");
			const { getUsage } = await import("@/orpc/scribe/_lib/get-usage");
			const { enforceScribeUsageLimit } = await import("@/orpc/scribe/handlers/usage-limit");
			const { usersHandler } = await import("@/orpc/admin/users");
			const { templatesHandler } = await import("@/orpc/templates");
			const { scribeFormsHandler } = await import("@/orpc/scribe-forms");
			const { scribeWorkspacesHandler } = await import("@/orpc/scribe-workspaces");
			const { documentsHandler } = await import("@/orpc/documents");
			const { PDFDocument } = await import("pdf-lib");
			const pdf = await PDFDocument.create();
			pdf.addPage();
			const pdfBase64 = Buffer.from(await pdf.save()).toString("base64");
			const server = await startTestServer("optional-stripe");
			try {
				const { user, session } = await createTestUser(server.db, { email: ADMIN_EMAIL, stripeCustomerId: null });
				await createTestSubscription(server.db, user.id);
				const entitlements = await resolveProductEntitlements({ db: server.db, userId: user.id });
				expect(entitlements).toEqual({
					canCreatePrivateAiScribeForms: false, canCreatePrivateDocuments: false, canCreatePrivateTemplates: false,
					hasActiveSubscription: false, plan: "free", scribeMonthlyCostLimit: 0.3,
					subscriptionPeriodEnd: null, subscriptionPeriodStart: null,
				});
				const context = createTestContext({ db: server.db, session });
				const publicTemplate = await call(templatesHandler.create, { name: "Public without billing", category: "Test", content: "Hello", visibility: "public" }, { context });
				expect(publicTemplate.visibility).toBe("public");
				await expect(call(templatesHandler.create, { name: "Private without billing", category: "Test", content: "Hello", visibility: "private" }, { context })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.not.stringMatching(/Plus|Abo|upgrade/i) });
				for (const [handler, input] of [
					[scribeFormsHandler.create, { name: "AI form", slug: "audit-form", enabled: true, promptHarness: "diagnosis", templateId: null }],
					[scribeWorkspacesHandler.create, { name: "Brief workspace" }],
					[documentsHandler.templates.create, { title: "PDF", category: "Test", fieldDefinitions: { inputs: [], bindings: [] }, pdfBase64 }],
				]) {
					const created = await call(handler, { ...input, visibility: "public" }, { context });
					expect(created.visibility).toBe("public");
					await expect(call(handler, { ...input, visibility: "private" }, { context })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.not.stringMatching(/Plus|Abo|upgrade/i) });
				}
				await createTestUsageEvent(server.db, user.id, { cost: 0.29 });
				await enforceScribeUsageLimit({ db: server.db, session, entitlements });
				await createTestUsageEvent(server.db, user.id, { cost: 0.01 });
				const usage = await getUsage(session, server.db);
				expect(usage.subscriptionsEnabled).toBe(false);
				expect(usage.usage.periodType).toBe("calendar");
				expect(usage.usage.monthlyUsagePercentage).toBe(100);
				await expect(enforceScribeUsageLimit({ db: server.db, session, entitlements })).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.not.stringMatching(/Abo|upgrade/i) });
				await enforceScribeUsageLimit({ db: server.db, session, entitlements, isQuotaExempt: true });
				const users = await call(usersHandler.list, undefined, { context });
				expect(users.find(candidate => candidate.id === user.id)).toMatchObject({ hasActiveSubscription: false, subscriptionPlan: "free", subscriptionStatus: null, monthlyUsageCostLimit: 0.3 });
			} finally {
				await server.close();
			}
		`,
		);
	}, 30_000);
});
