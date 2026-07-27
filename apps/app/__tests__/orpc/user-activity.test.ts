import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { call } from "@orpc/server";
import { aiScribeFormConfig, usageEvent } from "@repo/database";

import type { TestServer } from "@/__tests__/setup";
import {
	createMockSession,
	createTestContext,
	createTestUser,
	startTestServer,
} from "@/__tests__/setup";
import { activityHandler } from "@/orpc/user/activity";

describe("user activity handlers", () => {
	let server: TestServer;

	beforeEach(async () => {
		server = await startTestServer("user-activity");
	});

	afterEach(async () => {
		await server?.close();
	});

	test("prioritizes the user's 30-day AI functions and fills from global usage", async () => {
		const { user } = await createTestUser(server.db, {
			email: "dashboard-user@example.com",
		});
		const { user: otherUser } = await createTestUser(server.db, {
			email: "dashboard-other@example.com",
		});
		const { user: newUser } = await createTestUser(server.db, {
			email: "dashboard-new@example.com",
		});
		const now = new Date();
		const oldTimestamp = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
		const events = [
			...Array.from({ length: 3 }, () => ({
				metadata: { endpoint: "anamnese" },
				name: "ai_scribe_generation",
				userId: user.id,
			})),
			...Array.from({ length: 5 }, () => ({
				metadata: { endpoint: "procedures" },
				name: "ai_scribe_generation",
				userId: otherUser.id,
			})),
			...Array.from({ length: 4 }, () => ({
				metadata: { endpoint: "custom:builtin-discharge" },
				name: "ai_scribe_generation",
				userId: otherUser.id,
			})),
			{
				metadata: { endpoint: "diagnosis" },
				name: "ai_scribe_generation",
				timestamp: oldTimestamp,
				userId: user.id,
			},
		];
		await server.db.insert(usageEvent).values(events);

		const recommendations = await call(activityHandler.aiFunctionRecommendations, undefined, {
			context: createTestContext({
				db: server.db,
				session: createMockSession(user),
			}),
		});

		expect(recommendations).toEqual(["er", "procedures", "discharge"]);

		const globalRecommendations = await call(activityHandler.aiFunctionRecommendations, undefined, {
			context: createTestContext({
				db: server.db,
				session: createMockSession(newUser),
			}),
		});
		expect(globalRecommendations).toEqual(["procedures", "discharge", "er"]);
	});

	test("enriches recent generation events with the AI form name", async () => {
		const { user } = await createTestUser(server.db, {
			email: "activity-user@example.com",
		});
		const formId = crypto.randomUUID();
		await server.db.insert(aiScribeFormConfig).values({
			authorId: user.id,
			id: formId,
			inputPreset: "default",
			name: "Neurologischer Kurzbrief",
			promptHarness: "discharge",
			slug: "neurologischer-kurzbrief",
		});
		await server.db.insert(usageEvent).values({
			metadata: {
				customFormId: formId,
				customFormSlug: "neurologischer-kurzbrief",
				endpoint: "custom:neurologischer-kurzbrief",
			},
			name: "ai_scribe_generation",
			userId: user.id,
		});

		const recentActivity = await call(activityHandler.recentActivity, undefined, {
			context: createTestContext({
				db: server.db,
				session: createMockSession(user),
			}),
		});

		expect(recentActivity[0]?.customFormName).toBe("Neurologischer Kurzbrief");
	});
});
