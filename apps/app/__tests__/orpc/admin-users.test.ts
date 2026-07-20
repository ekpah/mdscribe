import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { eq, subscription } from "@repo/database";

import {
	ADMIN_EMAIL,
	createTestContext,
	createTestSubscription,
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

	test("uses the canonical active statuses and plan across subscription history", async () => {
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
		expect(listedUser?.subscriptionPlan).toBe("plus");
		expect(listedUser?.subscriptionStatus).toBe("active");
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
