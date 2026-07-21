import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { aiScribeFormConfig, aiScribeWorkspace, eq, subscription } from "@repo/database";

import {
	ADMIN_EMAIL,
	createTestContext,
	createTestSubscription,
	createTestUsageEvent,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import type { TestServer } from "@/__tests__/setup";
import { usersHandler } from "@/orpc/admin/users";

describe("Admin users", () => {
	let server: TestServer;
	let context: ReturnType<typeof createTestContext>;

	beforeEach(async () => {
		server = await startTestServer("admin-users");
		const { session } = await createTestUser(server.db, { email: ADMIN_EMAIL });
		context = createTestContext({ db: server.db, session });
	});

	afterEach(async () => {
		await server?.close();
	});

	test("uses the active subscription plan across subscription history", async () => {
		const { user } = await createTestUser(server.db);
		await createTestSubscription(server.db, user.id, { plan: "plus", status: "past_due" });
		await createTestSubscription(server.db, user.id, { plan: "legacy", status: "active" });
		await createTestSubscription(server.db, user.id, { plan: "plus", status: "canceled" });
		const subscriptions = await server.db
			.select()
			.from(subscription)
			.where(eq(subscription.referenceId, user.id));
		expect(subscriptions).toHaveLength(3);

		const users = await call(usersHandler.list, undefined, { context });
		const listedUser = users.find((candidate) => candidate.id === user.id);

		expect(listedUser?.hasActiveSubscription).toBe(true);
		expect(listedUser?.subscriptionPlan).toBe("legacy");
		expect(listedUser?.subscriptionStatus).toBe("active");
	});

	test("returns monthly cost, plan allowance, and custom AI content counts", async () => {
		const { user } = await createTestUser(server.db);
		await createTestSubscription(server.db, user.id);
		await createTestUsageEvent(server.db, user.id, { cost: 1.25 });
		await server.db.insert(aiScribeFormConfig).values({
			authorId: user.id,
			inputPreset: "default",
			name: "Custom form",
			promptHarness: "diagnosis",
			slug: `form-${crypto.randomUUID()}`,
		});
		await server.db.insert(aiScribeWorkspace).values({
			authorId: user.id,
			name: "Custom workspace",
			slug: `workspace-${crypto.randomUUID()}`,
		});

		const users = await call(usersHandler.list, undefined, { context });
		const listedUser = users.find((candidate) => candidate.id === user.id);

		expect(listedUser?.monthlyUsageCost).toBe(1.25);
		expect(listedUser?.monthlyUsageCostLimit).toBe(8);
		expect(listedUser?._count.aiScribeForms).toBe(1);
		expect(listedUser?._count.aiScribeWorkspaces).toBe(1);
	});

	test.each(["past_due", "canceled", "cancelled", "ACTIVE"])(
		"does not grant Plus for %s",
		async (status) => {
			const { user } = await createTestUser(server.db);
			await createTestSubscription(server.db, user.id, { plan: "plus", status });

			const users = await call(usersHandler.list, undefined, { context });
			const listedUser = users.find((candidate) => candidate.id === user.id);

			expect(listedUser?.hasActiveSubscription).toBe(false);
			expect(listedUser?.subscriptionPlan).toBe("free");
			expect(listedUser?.subscriptionStatus).toBe(status);
		},
	);
});
